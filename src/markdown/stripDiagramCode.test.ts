import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '@/markdown/pipeline'
import { isSkipLang } from '@/markdown/stripDiagramCode'

describe('stripDiagramCode', () => {
  it('mermaid / plantuml / puml / kuml 都标记为 skip', () => {
    expect(isSkipLang('mermaid')).toBe(true)
    expect(isSkipLang('plantuml')).toBe(true)
    expect(isSkipLang('puml')).toBe(true)
    expect(isSkipLang('kuml')).toBe(true)
    expect(isSkipLang('javascript')).toBe(false)
    expect(isSkipLang('text')).toBe(false)
  })

  it('kuml 代码块走完 pipeline：内部 code 保留源码，shiki 不染指', async () => {
    const md = ['```kuml', 'Diagram:', '  A -> B', '```'].join('\n')
    const html = await renderMarkdown(md)
    expect(html).toContain('Diagram:')
    expect(html).toContain('A -> B')
    expect(html).toContain('language-kuml')
    expect(html).not.toContain('plantuml-container')
  })

  it('mermaid 代码块走完 pipeline：内部 code 保留源码，shiki 不染指', async () => {
    const md = ['```mermaid', 'graph TD', '  A --> B', '```'].join('\n')
    const html = await renderMarkdown(md)
    // 保留源码（脱去回车 / 行首空格）
    expect(html).toContain('graph TD')
    expect(html).toContain('A --> B')
    // 类名未被 shiki 着色替换
    expect(html).toContain('language-mermaid')
    // 不应包含 plantuml 容器
    expect(html).not.toContain('plantuml-container')
  })

  it('plantuml 代码块保留 language-plantuml 类且源码完整', async () => {
    const md = ['```plantuml', '@startuml', 'A -> B', '@enduml', '```'].join('\n')
    const html = await renderMarkdown(md)
    expect(html).toContain('@startuml')
    expect(html).toContain('@enduml')
    // plantumlHighlight 给 -> 加了 hl-arrow span，源码可能被切片；
    // 但 'A' 和 'B' 这两个非特殊 token 仍以 text 节点出现。
    expect(html).toMatch(/A.+->.+B/)
    expect(html).toContain('language-plantuml')
  })

  it('普通代码块（javascript）走 shiki 正常工作', async () => {
    const md = ['```js', 'const a = 1', '```'].join('\n')
    const html = await renderMarkdown(md)
    expect(html).toContain('const')
    // jsdom 下我们走 noop shiki，因此只验证 className 而非具体 token
    expect(html).toContain('language-js')
  })
})
