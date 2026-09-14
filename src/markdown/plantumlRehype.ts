import type { Plugin } from 'unified'
import type { Root, Element, ElementContent, Text, Properties } from 'hast'
import { visit } from 'unist-util-visit'
// 类型在 src/types/plantuml-encoder.d.ts 中声明
import plantumlEncoder from 'plantuml-encoder'

/**
 * PlantUML rehype 插件：
 *
 * 扫描所有 `<pre><code class="language-plantuml">…</code></pre>`，
 * 将其替换为指向 PlantUML 渲染服务的 `<img>` 标签。
 *
 * 渲染端点优先级：
 *   1) 调用方传入 `serverUrl`（最优先）
 *   2) Tauri 后端 `get_plantuml_server_url` —— 后端启动时会尝试拉一个
 *      本地 java -jar 服务（端口 18080），成功就把它的 svg 端点前缀
 *      暴露给前端。失败时返 None —— 走下一步。
 *   3) 默认官方服务 https://www.plantuml.com/plantuml（公开端点）。
 *
 *   - 渲染失败由浏览器原生 `<img>` 的 onerror 兜底显示源码占位。
 *
 * 设计原则：
 *   - 渲染结果**只读不写**：原代码块文本保留在 `data-plantuml-source`，
 *     用户可一键复制或本地另存。
 *   - 安全：源码不参与 HTML 字符串拼接，全部走 hast 节点操作，
 *     sanitize 后不会被解释为脚本。
 */

import { isTauri } from '@/services/env'

export interface PlantumlOptions {
  /** PlantUML 渲染服务 base URL，默认从后端探测，失败用官方 */
  serverUrl?: string
  /** 输出格式：svg（默认，可缩放） / png */
  format?: 'svg' | 'png'
  /** 自定义 class，挂在生成的 <img> 上 */
  className?: string
}

const DEFAULTS: Required<Omit<PlantumlOptions, 'serverUrl'>> = {
  format: 'svg',
  className: 'plantuml-diagram',
}

/**
 * 异步探测 PlantUML 服务 URL：
 *   - 后端优先（Tauri 自带本地 jar）
 *   - 失败回退到官方服务
 */
export async function resolvePlantumlServerUrl(): Promise<string> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const url = await invoke<string | null>('get_plantuml_server_url')
      if (url && url.length > 0) return url
    } catch {
      /* fall through */
    }
  }
  return 'https://www.plantuml.com/plantuml'
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

function buildFallbackPre(
  source: string,
  className: string,
  preservedChildren?: ElementContent[],
): Element {
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
        // 如果上游 highlight 已经给 code 注入了 hl-* spans，
        // 保留它们以便降级时仍能看到高亮；否则用纯文本。
        children: preservedChildren ?? [{ type: 'text', value: source }],
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
  // serverUrl 现在是可选 —— 由调用方显式传入；不传时退化到 DEFAULTS 兜底。
  const opts = {
    serverUrl: options.serverUrl ?? 'https://www.plantuml.com/plantuml',
    format: options.format ?? DEFAULTS.format,
    className: options.className ?? DEFAULTS.className,
  }

  const transformer = (tree: Root): void => {
    try {
      visit(tree, 'element', (node: Element, index, parent) => {
        if (!parent || index === undefined || index === null) return
        // 我们要替换的是 <pre>，触发条件是其内部包含 language-plantuml <code>
        if (node.tagName !== 'pre') return

        const preChildren = (node.children ?? []) as ElementContent[]
        const codeChild = preChildren.find(
          (c): c is Element => c.type === 'element' && c.tagName === 'code',
        )
        if (!codeChild) return
        if (!isPlantumlCode(codeChild)) return

        const source = collectText(codeChild).trim()
        if (!source) return

        const url = buildImageUrl(source, opts)
        const alt = `PlantUML diagram (${source.split('\n')[0]?.slice(0, 60) || 'diagram'})`
        const img = buildImgNode(url, source, alt, opts.className)
        const fallback = buildFallbackPre(
          source,
          opts.className,
          (codeChild.children ?? []) as ElementContent[],
        )

        const replacement: Element = {
          type: 'element',
          tagName: 'div',
          properties: {
            className: ['plantuml-container'],
            'data-plantuml-state': 'loading',
          } as Properties,
          children: [img, fallback],
        }

        // 关键：parent.children 一定要保证替换后 *不出现* sparse hole。
        // 因为 unist-util-visit 内部会在我们修改后的数组里递归（`'children' in node`），
        // 如果某次替换留下了 undefined hole，递归就会拿到 undefined 触发 'in' 错误。
        // 这里创建一个 *新数组* 替换整个 children，避免稀疏数组。
        const parentChildren = (parent.children ?? []) as ElementContent[]
        if (index < 0 || index >= parentChildren.length) return
        const newChildren = parentChildren.slice()
        newChildren[index] = replacement
        ;(parent as unknown as { children: typeof newChildren }).children = newChildren
      })
    } catch (err) {
      console.warn('[plantumlRehype] visit failed, skipping transformation:', err)
    }
  }

  return transformer
}