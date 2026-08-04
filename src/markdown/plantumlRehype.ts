import type { Plugin } from 'unified'
import type { Root, Element, ElementContent, Text, Properties } from 'hast'
import { visit } from 'unist-util-visit'
// 类型在 src/types/plantuml-encoder.d.ts 中声明
import plantumlEncoder from 'plantuml-encoder'

/**
 * PlantUML rehype 插件：
 *
 * 扫描所有 `<pre><code class="language-plantuml">…</code></pre>`，
 * 将其替换为指向官方 PlantUML 渲染服务的 `<img>` 标签。
 *
 * 渲染走 https://www.plantuml.com/plantuml（公开端点）。
 *   - 服务地址可通过配置覆盖（自部署 PlantUML server 时）。
 *   - 渲染失败由浏览器原生 `<img>` 的 onerror 兜底显示源码占位。
 *
 * 设计原则：
 *   - 渲染结果**只读不写**：原代码块文本保留在 `data-plantuml-source`，
 *     用户可一键复制或本地另存。
 *   - 安全：源码不参与 HTML 字符串拼接，全部走 hast 节点操作，
 *     sanitize 后不会被解释为脚本。
 */

export interface PlantumlOptions {
  /** PlantUML 渲染服务 base URL，默认官方服务 */
  serverUrl?: string
  /** 输出格式：svg（默认，可缩放） / png */
  format?: 'svg' | 'png'
  /** 自定义 class，挂在生成的 <img> 上 */
  className?: string
}

const DEFAULTS: Required<PlantumlOptions> = {
  serverUrl: 'https://www.plantuml.com/plantuml',
  format: 'svg',
  className: 'plantuml-diagram',
}

/** 是否匹配 PlantUML 代码块 */
function isPlantumlCode(node: Element): boolean {
  if (node.tagName !== 'code') return false
  const className = node.properties?.className
  if (!Array.isArray(className)) return false
  return className.some(
    (c: unknown) =>
      typeof c === 'string' &&
      // 命中：language-plantuml、language-language-plantuml、plantuml、language-puml 等
      /(^|-)(plantuml|puml)$/i.test(c),
  )
}

/** 从 code 节点收集原始文本 */
function collectText(node: Element): string {
  let out = ''
  for (const child of node.children) {
    if (child.type === 'text') {
      out += (child as Text).value
    } else if (child.type === 'element') {
      out += collectText(child as Element)
    }
  }
  return out
}

function buildImageUrl(source: string, opts: Required<PlantumlOptions>): string {
  const encoded = plantumlEncoder.encode(source)
  return `${opts.serverUrl}/${opts.format}/${encoded}`
}

function buildImgNode(url: string, source: string, alt: string, className: string): Element {
  return {
    type: 'element',
    tagName: 'img',
    properties: {
      src: url,
      alt,
      className: [className],
      loading: 'lazy',
      // 把源码作为属性挂载，便于离线降级时回退显示
      'data-plantuml-source': source,
    } as Properties,
    children: [],
  }
}

function buildFallbackPre(source: string, className: string): Element {
  return {
    type: 'element',
    tagName: 'pre',
    properties: {
      className: [className, 'plantuml-fallback'],
      'data-plantuml-source': source,
      hidden: false,
    } as Properties,
    children: [
      {
        type: 'element',
        tagName: 'code',
        properties: {
          className: ['language-plantuml'],
        } as Properties,
        children: [{ type: 'text', value: source }],
      },
    ],
  }
}

/**
 * unified plugin（rehype 阶段）。
 *
 * 直接作为 `unified().use(plantumlRehype, { format: 'svg' })` 使用。
 * 注意：必须在 `remarkRehype` 之后、`rehypeSanitize` 之前使用。
 */
export const plantumlRehype: Plugin<[PlantumlOptions], Root, Root> = (options = {}) => {
  const opts: Required<PlantumlOptions> = { ...DEFAULTS, ...options }

  const transformer = (tree: Root): void => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (!parent || index === undefined || index === null) return
      // 我们要替换的是 <pre>，触发条件是其内部包含 language-plantuml <code>
      if (node.tagName !== 'pre') return

      const codeChild = node.children.find(
        (c): c is Element => c.type === 'element' && c.tagName === 'code',
      )
      if (!codeChild) return
      if (!isPlantumlCode(codeChild)) return

      const source = collectText(codeChild).trim()
      if (!source) return

      // 直接把 <pre> 替换为 <div class="plantuml-container"><img/><pre.fallback/></div>
      const url = buildImageUrl(source, opts)
      const alt = `PlantUML diagram (${source.split('\n')[0]?.slice(0, 60) || 'diagram'})`
      const img = buildImgNode(url, source, alt, opts.className)
      const fallback = buildFallbackPre(source, opts.className)

      const replacement: Element = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['plantuml-container'],
          'data-plantuml-state': 'loading',
        } as Properties,
        children: [img, fallback],
      }

      const children = parent.children as ElementContent[]
      children[index] = replacement
    })
  }

  return transformer
}