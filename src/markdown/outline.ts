/**
 * 极简 Markdown 大纲提取：从 ATX 风格标题 (# / ## / ### ...) 解析出层级与文本。
 * 实际产品中我们会替换成 remark 解析出的 mdast，但这里先提供一个零依赖实现，
 * 让大纲功能在没有依赖的情况下也能工作。
 */
export interface OutlineNode {
  level: number
  text: string
  line: number
}

const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/

export function extractOutline(source: string): OutlineNode[] {
  const lines = source.split(/\r?\n/)
  const outline: OutlineNode[] = []
  lines.forEach((rawLine, idx) => {
    const match = HEADING_RE.exec(rawLine)
    if (!match) return
    const level = match[1].length
    const text = match[2].trim()
    if (!text) return
    outline.push({ level, text, line: idx + 1 })
  })
  return outline
}