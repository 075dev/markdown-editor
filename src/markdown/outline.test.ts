import { describe, expect, it } from 'vitest'
import { extractOutline } from '@/markdown/outline'

describe('extractOutline', () => {
  it('extracts headings with line numbers', () => {
    const md = `# Title\n\nSome text\n\n## Section A\n\n### Section A.1\n`
    const outline = extractOutline(md)
    expect(outline).toEqual([
      { level: 1, text: 'Title', line: 1 },
      { level: 2, text: 'Section A', line: 5 },
      { level: 3, text: 'Section A.1', line: 7 },
    ])
  })

  it('ignores trailing hashes and empty headings', () => {
    const md = `# Title ###\n## \n## Real\n`
    const outline = extractOutline(md)
    expect(outline.map((o) => o.text)).toEqual(['Title', 'Real'])
  })

  it('returns empty array when no headings exist', () => {
    expect(extractOutline('just text\nno headings')).toEqual([])
  })
})