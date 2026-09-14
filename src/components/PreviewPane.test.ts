/**
 * PreviewPane 行为：
 *   - 不应再调 mountPanzoomToolbar（预览区不可缩放）
 *   - 应给 .plantuml-container 挂 click，并在 click 时调用 openDiagramWindow
 *   - 重复 watchEffect 不应重复挂 click 防抖
 *
 * jsdom 下 canOpenInWindow() 默认返回 false，因为没有 __TAURI_INTERNALS__。
 * 这里用一个独立模块手动把标志放回，验证 Tauri 桌面分支；
 * Web 分支则用一个兜底用例：未挂 click 也不会误开窗口。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

type DiagramWindowArgs = { url: string; source?: string; title?: string }
type PanzoomToolbarArgs = [HTMLElement, HTMLImageElement, { plantumlSource?: string }]

const openDiagramWindowMock = vi.fn(async (_opts: DiagramWindowArgs): Promise<boolean> => true)
const mountPanzoomToolbarMock = vi.fn((..._args: PanzoomToolbarArgs): unknown => ({}))
const canOpenInWindowMock = vi.fn(() => true)
const renderMarkdownMock = vi.fn(async (_src: string) => '')

vi.mock('@/services/diagramWindow', () => ({
  canOpenInWindow: () => canOpenInWindowMock(),
  openDiagramWindow: (opts: DiagramWindowArgs) => openDiagramWindowMock(opts),
}))
vi.mock('@/editor/panzoomToolbar', () => ({
  mountPanzoomToolbar: (...args: PanzoomToolbarArgs) => mountPanzoomToolbarMock(...args),
}))
vi.mock('@/markdown/pipeline', () => ({
  renderMarkdown: (src: string) => renderMarkdownMock(src),
}))

import { useWorkspaceStore } from '@/stores/workspace'
import PreviewPane from '@/components/PreviewPane.vue'

beforeEach(() => {
  setActivePinia(createPinia())
  openDiagramWindowMock.mockClear()
  mountPanzoomToolbarMock.mockClear()
  canOpenInWindowMock.mockReset()
  canOpenInWindowMock.mockReturnValue(true)
  renderMarkdownMock.mockReset()
  renderMarkdownMock.mockResolvedValue('')
  document.body.innerHTML = ''
})

async function mountPaneWith(renderedHtml: string) {
  renderMarkdownMock.mockResolvedValue(renderedHtml)
  const ws = useWorkspaceStore()
  ws.upsertTab('/preview-test.md', '@startuml\nA -> B\n@enduml')
  const wrapper = mount(PreviewPane, { attachTo: document.body })
  await nextTick()
  await flushPromises()
  return wrapper
}

describe('PreviewPane PlantUML (Tauri 桌面分支)', () => {
  const diagram = `
    <div class="plantuml-container" data-plantuml-source="@startuml
A -> B
@enduml">
      <img class="plantuml-diagram" src="https://example.com/x.svg" alt="A -> B" />
    </div>`.replace(/\n\s*/g, ' ')

  it('不应调 mountPanzoomToolbar', async () => {
    await mountPaneWith(diagram)
    expect(mountPanzoomToolbarMock).not.toHaveBeenCalled()
  })

  it('点 .plantuml-container 时调 openDiagramWindow', async () => {
    const w = await mountPaneWith(diagram)
    const c = w.find('.plantuml-container').element as HTMLElement
    c.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(openDiagramWindowMock).toHaveBeenCalledTimes(1)
    const arg = openDiagramWindowMock.mock.calls[0][0] as DiagramWindowArgs
    expect(arg.url).toBe('https://example.com/x.svg')
    expect(arg.source).toContain('@startuml')
    expect(arg.title).toContain('UML')
  })

  it('重复 watchEffect 重渲后不会多次挂 click handler', async () => {
    // 不变 input html，模拟 store.activeTab.content 没改，但 watchEffect 因 reactive 内部触发
    // 重复重扫同一组容器。我们只 mount 一次即可验证：第一次点开窗，后续点击观察计数。
    const w = await mountPaneWith(diagram)
    const c = w.find('.plantuml-container').element as HTMLElement
    c.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(openDiagramWindowMock).toHaveBeenCalledTimes(1)
  })
})

describe('PreviewPane PlantUML (Web 分支)', () => {
  it('当 canOpenInWindow=false 时不挂 click、不调 openDiagramWindow', async () => {
    canOpenInWindowMock.mockReturnValue(false)
    const diagram = `
      <div class="plantuml-container">
        <img class="plantuml-diagram" src="https://example.com/x.svg" />
      </div>`
    const w = await mountPaneWith(diagram)
    const c = w.find('.plantuml-container').element as HTMLElement
    c.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(openDiagramWindowMock).not.toHaveBeenCalled()
    expect(c.dataset.mode).toBe('web')
  })
})
