import type { Plugin } from 'unified'
import type { Root, Element, ElementContent } from 'hast'
import { visit } from 'unist-util-visit'

/**
 * PlantUML 自写语法高亮器：
 *   识别 PlantUML 关键字、控制指令、箭头与注释。
 *   输出格式：hast 节点 <span class="hl-...">，由 rehype-stringify + sanitize 渲染为 HTML。
 *
 * 范围（精简但覆盖主流）：
 *   - 块指令：@startuml / @enduml / @startdot / @enddot / @startsalt / @endsalt
 *   - 类型关键字：class / interface / abstract / enum / annotation / struct
 *   - 关系元素：actor / participant / usecase / component / boundary / control /
 *              entity / database / queue / node / frame / cloud / rectangle /
 *              package / state / note / object / map
 *   - 控制流：if / then / else / endif / while / endwhile / repeat / repeat while /
 *             fork / again / end / detach / kill / return / group / split
 *   - 箭头：-> --> <- <-- <-> ..> ..
 *   - 注释：' 行注释；/' ... '/ 块注释
 *
 * 注意：本高亮器仅处理语义着色，不修改任何 <pre> / <code> 结构，
 * sanitize 后 PlantUML 图容器替换（plantumlRehype）仍能正确识别 code class。
 */

const KEYWORDS = new Set([
  'class',
  'interface',
  'abstract',
  'enum',
  'annotation',
  'struct',
  'actor',
  'participant',
  'usecase',
  'component',
  'boundary',
  'control',
  'entity',
  'database',
  'queue',
  'node',
  'frame',
  'cloud',
  'rectangle',
  'package',
  'state',
  'note',
  'object',
  'map',
  'if',
  'then',
  'else',
  'endif',
  'while',
  'endwhile',
  'repeat',
  'fork',
  'again',
  'end',
  'detach',
  'kill',
  'return',
  'group',
  'split',
])

const DIRECTIVES = new Set([
  'startuml',
  'enduml',
  'startdot',
  'enddot',
  'startsalt',
  'endsalt',
  'startmindmap',
  'endmindmap',
  'startwbs',
  'endwbs',
  'startgantt',
  'endgantt',
])

// 箭头正则：覆盖 -> --> <- <-- <-> .. ..>
const ARROW_RE = /(-{1,2}>|<-{1,2}|<\->|\.{1,2}>?|\|-{1,2}>|<\|-{1,2})/g

// 块注释：/' ... '/（非贪婪，可跨多行）
// 行注释：以 ' 开头直到行尾
const BLOCK_COMMENT_RE = /\/\'(.*?)\'\//g
const LINE_COMMENT_RE = /'(.*)$/gm

interface TokenSpan {
  start: number
  end: number
  type: 'keyword' | 'directive' | 'arrow' | 'comment' | 'string'
}

function tokenize(source: string): TokenSpan[] {
  const spans: TokenSpan[] = []

  // 1. 块注释（先于其他规则，避免内部 token 误标）
  for (const m of source.matchAll(BLOCK_COMMENT_RE)) {
    if (m.index === undefined) continue
    spans.push({ start: m.index, end: m.index + m[0].length, type: 'comment' })
  }

  // 2. 行注释（避开块注释区域）
  for (const m of source.matchAll(LINE_COMMENT_RE)) {
    if (m.index === undefined) continue
    const start = m.index
    const end = m.index + m[0].length
    if (spans.some((s) => s.type === 'comment' && s.start <= start && s.end >= end)) continue
    spans.push({ start, end, type: 'comment' })
  }

  // 3. @ 指令
  for (const m of source.matchAll(/@(\w+)/g)) {
    if (m.index === undefined) continue
    const name = m[1].toLowerCase()
    if (DIRECTIVES.has(name)) {
      spans.push({ start: m.index, end: m.index + m[0].length, type: 'directive' })
    }
  }

  // 4. 关键字（按词边界匹配，跳过注释区）
  for (const m of source.matchAll(/\b([a-zA-Z_][\w]*)\b/g)) {
    if (m.index === undefined) continue
    if (!KEYWORDS.has(m[1].toLowerCase())) continue
    const start = m.index
    const end = start + m[0].length
    if (spans.some((s) => s.start <= start && s.end >= end)) continue
    spans.push({ start, end, type: 'keyword' })
  }

  // 5. 箭头
  for (const m of source.matchAll(ARROW_RE)) {
    if (m.index === undefined) continue
    const start = m.index
    const end = start + m[0].length
    if (spans.some((s) => s.start <= start && s.end >= end)) continue
    spans.push({ start, end, type: 'arrow' })
  }

  // 排序：先按 start，再按长度（长优先，避免 "->" 把 "-->" 截断）
  spans.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start))
  // 合并重叠（保守：保留第一个）
  const merged: TokenSpan[] = []
  let lastEnd = -1
  for (const s of spans) {
    if (s.start >= lastEnd) {
      merged.push(s)
      lastEnd = s.end
    }
  }
  return merged
}

/**
 * 把纯文本节点拆成多个 <span class="hl-*">，保留原文本字符。
 */
function wrapTokensToNodes(text: string, spans: TokenSpan[]): ElementContent[] {
  if (spans.length === 0) return [{ type: 'text', value: text }]

  const nodes: ElementContent[] = []
  let cursor = 0
  for (const span of spans) {
    if (span.start > cursor) {
      nodes.push({ type: 'text', value: text.slice(cursor, span.start) })
    }
    nodes.push({
      type: 'element',
      tagName: 'span',
      properties: { className: [`hl-${span.type}`] },
      children: [{ type: 'text', value: text.slice(span.start, span.end) }],
    })
    cursor = span.end
  }
  if (cursor < text.length) {
    nodes.push({ type: 'text', value: text.slice(cursor) })
  }
  return nodes
}

function isPlantumlCode(node: Element): boolean {
  if (node.tagName !== 'code') return false
  const className = node.properties?.className
  if (!Array.isArray(className)) return false
  return className.some(
    (c: unknown) =>
      typeof c === 'string' &&
      /(^|-)(plantuml|puml)$/i.test(c),
  )
}

function collectText(node: Element): string {
  let out = ''
  for (const child of node.children) {
    if (child.type === 'text') out += (child as { value: string }).value
    else if (child.type === 'element') out += collectText(child as Element)
  }
  return out
}

/**
 * 返回一个 unified rehype 插件，扫描 <code class="language-plantuml">
 * 并把其子节点替换为带 hl-* class 的 <span>。
 */
export const plantumlHighlight: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (!isPlantumlCode(node)) return
      // 收集原始文本
      const original = collectText(node)
      const tokens = tokenize(original)
      if (tokens.length === 0) return

      const newChildren = wrapTokensToNodes(original, tokens)
      node.children = newChildren as Element[]
    })
  }
}