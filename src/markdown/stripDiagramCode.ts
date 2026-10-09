/**
 * 预处理 rehype plugin：
 *   在 shiki 高亮之前，把 <pre><code class="language-mermaid|language-plantuml|language-puml|language-kuml">
 *   替换为「保留源码的 pre + 纯文本 code」。
 *
 * 为何要有这个插件：
 *   - markdown 渲染管线中，shiki-rehype 4.4.1 在处理某些边界情况（sparse hole、
 *     children 缺失）时会触发 'children' in undefined 的 in 操作符错误。
 *     实际崩溃链路：用户包含 mermaid / plantuml 代码块时，shiki 在 fallback
 *     处理这些代码的内部会出现 node = undefined 的递归 → 抛 TypeError。
 *   - 让 shiki 看不到这些 pre：把 code 替换成纯文本节点，shiki 的 PreHandler
 *     取 head = null 直接 return，不调 codeToHast，整体绕开问题。
 *   - 后续 plantumlRehype / 客户端 mermaid 仍能读到源码（我们把文本保留在
 *     一个 <code class="language-x"> 节点上）。
 *
 * 注意：替换时机必须在 shiki 之前、remark-rehype 之后。
 */
import { visit } from 'unist-util-visit'
import type { Plugin } from 'unified'
import type { Root, Element, ElementContent } from 'hast'

const SKIP_LANGS = new Set(['mermaid', 'plantuml', 'puml', 'kuml'])

/** 暴露给测试 / 调试 */
export function isSkipLang(lang: string): boolean {
  return SKIP_LANGS.has(lang)
}

export const stripDiagramCode: Plugin<[], Root, Root> = () => {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (!parent || index === undefined || index === null) return
      if (node.tagName !== 'pre') return

      // 安全取 children：缺失时按空数组，避免 unified visit 触 in-undefined。
      const preChildren = (node.children ?? []) as ElementContent[]
      const codeChild = preChildren.find(
        (c): c is Element => c.type === 'element' && c.tagName === 'code',
      )
      if (!codeChild) return

      const classes = (codeChild.properties?.className ?? []) as Array<string | number>
      let lang = ''
      for (const c of classes) {
        if (typeof c !== 'string') continue
        if (c.startsWith('language-')) {
          lang = c.slice('language-'.length)
          break
        }
      }
      if (!SKIP_LANGS.has(lang)) return

      // 收集源码（文本节点拼接）
      const source = collectText(codeChild)
      if (!source) return

      // 把 <code> 替换为承载源码的「纯文本 code」—— shiki 不再触碰它（因为我们
      // 是更早的 plugin）；同时保留 className 让 plantumlRehype / services/mermaid
      // 能识别它。
      const replacementCode: Element = {
        type: 'element',
        tagName: 'code',
        properties: {
          className: [`language-${lang}`],
          // 留个 data-*，plantumlRehype 走自己的逻辑
          ...(lang === 'plantuml' || lang === 'puml'
            ? { 'data-plantuml-source': source }
            : {}),
          ...(lang === 'mermaid' ? { 'data-mermaid-source': source } : {}),
        } as Element['properties'],
        children: [{ type: 'text', value: source }],
      }

      // 直接重置 pre 的 children 为单一 code（仍然是 hast element，不是 sparse）。
      // 同时保证 pre.children 仍是个 ElementContent[]（不会缺少字段），
      // 让下游 shiki / sanitize / stringify 都安全。
      node.children = [replacementCode]
    })
  }
}

function collectText(node: Element): string {
  if (!node.children || node.children.length === 0) return ''
  const parts: string[] = []
  for (const c of node.children) {
    if (c.type === 'text' || c.type === 'element') {
      if (c.type === 'text') {
        parts.push(c.value)
      } else if (c.type === 'element') {
        parts.push(collectText(c))
      }
    }
  }
  return parts.join('')
}
