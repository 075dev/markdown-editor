import { describe, expect, it, vi } from 'vitest'

// 默认情况下 isTauri() 在 jsdom 下为 false，应当 fallback 到官方 URL。
vi.mock('@/services/env', () => ({ isTauri: () => false }))

import { resolvePlantumlServerUrl } from '@/markdown/plantumlRehype'
import { renderMarkdown } from '@/markdown/pipeline'

describe('renderMarkdown — PlantUML code blocks', () => {
  it('replaces plantuml fenced block with an img pointing to plantuml.com', async () => {
    const md = [
      '```plantuml',
      '@startuml',
      'Alice -> Bob: Hello',
      '@enduml',
      '```',
    ].join('\n')
    const html = await renderMarkdown(md)
    expect(html).toContain('<img')
    expect(html).toContain('https://www.plantuml.com/plantuml/svg/')
    expect(html).toContain('class="plantuml-diagram"')
    // 降级源码块默认存在但隐藏
    expect(html).toContain('plantuml-fallback')
    expect(html).toContain('@startuml')
  })

  it('also matches language-plantuml class alias', async () => {
    const md = [
      '```language-plantuml',
      '@startuml',
      'A --> B',
      '@enduml',
      '```',
    ].join('\n')
    const html = await renderMarkdown(md)
    expect(html).toContain('https://www.plantuml.com/plantuml/svg/')
  })

  it('ignores non-plantuml code blocks', async () => {
    const md = [
      '```js',
      'console.log(1)',
      '```',
    ].join('\n')
    const html = await renderMarkdown(md)
    expect(html).not.toContain('plantuml')
  })

  it('strips <script> even when injected inside a plantuml block', async () => {
    // 即便用户在源码里塞脚本，sanitize 也必须在最后一道把关
    const md = [
      '```plantuml',
      '@startuml',
      'Alice -> Bob: <script>alert(1)</script>',
      '@enduml',
      '```',
    ].join('\n')
    const html = await renderMarkdown(md)
    expect(html).not.toContain('<script')
    expect(html).toContain('plantuml')
  })

  it('preserves non-PlantUML diagrams untouched (Mermaid fences)', async () => {
    const md = [
      '```mermaid',
      'graph TD; A-->B',
      '```',
    ].join('\n')
    const html = await renderMarkdown(md)
    // Mermaid 不在 pipeline 里转（避免 SSR / OffscreenCanvas 风险），
    // PreviewPane 的 services/mermaid.ts 在客户端扫 <pre.language-mermaid> 渲染。
    expect(html).not.toContain('plantuml')
    expect(html).toContain('language-mermaid')
  })
})

describe('resolvePlantumlServerUrl', () => {
  it('在非 Tauri 环境回退到官方 URL', async () => {
    const url = await resolvePlantumlServerUrl()
    expect(url).toBe('https://www.plantuml.com/plantuml')
  })
})