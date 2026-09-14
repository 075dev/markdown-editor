import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/markdown/pipeline'

describe('renderMarkdown — PlantUML inline highlighting', () => {
  it('wraps PlantUML keywords in span.hl-keyword', async () => {
    const md = '```plantuml\n@startuml\nclass Foo\n@enduml\n```'
    const html = await renderMarkdown(md)
    // shiki 在 jsdom 下被跳过（避免 wasm 报错），但 plantumlHighlight 仍生效
    expect(html).toContain('hl-keyword')
    expect(html).toContain('class')
  })

  it('wraps @startuml / @enduml in span.hl-directive', async () => {
    const md = '```plantuml\n@startuml\nA -> B\n@enduml\n```'
    const html = await renderMarkdown(md)
    expect(html).toContain('hl-directive')
    expect(html).toMatch(/hl-directive[^>]*>@startuml/)
  })

  it('wraps arrows in span.hl-arrow', async () => {
    const md = '```plantuml\n@startuml\nA -> B\nA --> B\nA ..> B\n@enduml\n```'
    const html = await renderMarkdown(md)
    expect(html).toContain('hl-arrow')
  })

  it('wraps line comments in span.hl-comment', async () => {
    const md = "```plantuml\n@startuml\n' this is a comment\nA -> B\n@enduml\n```"
    const html = await renderMarkdown(md)
    expect(html).toContain('hl-comment')
    expect(html).toContain('this is a comment')
  })

  it('does not affect non-PlantUML code blocks', async () => {
    const md = '```js\nclass Foo {}\n```'
    const html = await renderMarkdown(md)
    // 类名 `class` 是 JS/TS 关键字，codeHighlight 应给 span.hl-keyword 包起来；
    // 但不会生成 PlantUML 专属 hl-*（hl-directive/hl-arrow）。
    expect(html).toContain('hl-keyword')
    expect(html).not.toContain('hl-directive')
    expect(html).not.toContain('hl-arrow')
  })
})