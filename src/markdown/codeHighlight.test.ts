/**
 * codeHighlight 集成测试：覆盖几种语言，确保渲染管线产出 hl-* span。
 * 同时验证 mermaid / plantuml 不被上色（已被 stripDiagramCode 拦截）。
 */
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/markdown/pipeline'
import { listSupportedLanguages } from '@/markdown/codeHighlight'

describe('codeHighlight (in-pipeline)', () => {
  it('JS 代码块加 hl-keyword / hl-string / hl-comment', async () => {
    const html = await renderMarkdown(
      ['```js', "const s = 'hi' // note", "/* block */ function f(){return 1}", '```'].join('\n'),
    )
    expect(html).toContain('class="language-js"')
    expect(html).toContain('<span class="hl-keyword">const</span>')
    expect(html).toContain('<span class="hl-keyword">function</span>')
    expect(html).toContain('<span class="hl-string">\'hi\'</span>')
    expect(html).toContain('<span class="hl-comment">// note</span>')
    expect(html).toContain('<span class="hl-comment">/* block */</span>')
    expect(html).toContain('<span class="hl-number">1</span>')
  })

  it('未知语言保留为纯文本 + 等宽 className', async () => {
    const html = await renderMarkdown(
      ['```xyzlang', 'foo bar', '```'].join('\n'),
    )
    expect(html).toContain('class="language-xyzlang"')
    // 不应出现 hl-* span
    expect(html).not.toContain('hl-keyword')
    expect(html).not.toContain('hl-comment')
  })

  it('Python 关键字 + 字符串 + 注释', async () => {
    const html = await renderMarkdown(
      ['```python', '# comment', 'def fn():', '    return 42', "    s = 'hi'", '```'].join('\n'),
    )
    expect(html).toContain('<span class="hl-comment"># comment</span>')
    expect(html).toContain('<span class="hl-keyword">def</span>')
    expect(html).toContain('<span class="hl-keyword">return</span>')
    expect(html).toContain('<span class="hl-number">42</span>')
    expect(html).toContain('<span class="hl-string">\'hi\'</span>')
  })

  it('CSS 选择器 + 数字 + 注释', async () => {
    const html = await renderMarkdown(
      ['```css', '/* hi */', '.a { color: red; width: 12px; }', '```'].join('\n'),
    )
    expect(html).toContain('<span class="hl-comment">/* hi */</span>')
    expect(html).toContain('<span class="hl-number">12px</span>')
  })

  it('mermaid 不被 codeHighlight 上色（已被 stripDiagramCode 拦截）', async () => {
    const html = await renderMarkdown(
      ['```mermaid', 'graph TD', '  A-->B', '```'].join('\n'),
    )
    expect(html).toContain('language-mermaid')
    expect(html).not.toContain('hl-keyword')
  })

  it('plantuml 不被 codeHighlight 上色', async () => {
    const html = await renderMarkdown(
      ['```plantuml', '@startuml', 'A -> B', '@enduml', '```'].join('\n'),
    )
    expect(html).toContain('language-plantuml')
    expect(html).not.toContain('hl-keyword')
  })

  it('listSupportedLanguages 暴露语言表', () => {
    const langs = listSupportedLanguages()
    expect(langs).toContain('javascript')
    expect(langs).toContain('python')
    expect(langs).toContain('css')
    expect(langs).not.toContain('mermaid')
    expect(langs).not.toContain('plantuml')
  })
})
