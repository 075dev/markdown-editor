import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/markdown/pipeline'

describe('renderMarkdown', () => {
  it('renders plain text', async () => {
    const html = await renderMarkdown('Hello world')
    expect(html).toContain('Hello world')
  })

  it('renders GFM tables', async () => {
    const md = `| a | b |\n| - | - |\n| 1 | 2 |`
    const html = await renderMarkdown(md)
    expect(html).toContain('<table>')
    expect(html).toContain('<th>a</th>')
  })

  it('strips <script> tags via sanitizer', async () => {
    const html = await renderMarkdown('Hello <script>alert(1)</script>')
    // sanitizer 必须把 <script> 整段剥掉，文本不再包裹在脚本里
    expect(html).not.toContain('<script')
    expect(html).not.toContain('</script>')
  })

  it('strips javascript: links via sanitizer', async () => {
    const html = await renderMarkdown('[click](javascript:alert(1))')
    expect(html).not.toMatch(/javascript:/i)
  })

  it('renders task lists', async () => {
    const md = `- [x] done\n- [ ] todo`
    const html = await renderMarkdown(md)
    expect(html).toContain('checked')
    expect(html).toContain('checkbox')
  })
})