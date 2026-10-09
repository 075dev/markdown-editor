/**
 * PreviewPane 链接点击路由(add-002 T3,契约 event-flow.md 场景 4):
 *   - 事件委托:点击 <a> 一律 preventDefault(杜绝 WebView 当前窗口导航)
 *   - anchor → scrollIntoView(平滑滚动;目标不存在静默忽略)
 *   - external → externalLinks.openExternal(原 href);失败 → 状态栏错误
 *   - document → resolveDocumentHref → workspace.openFileFromPath;
 *     Web 模式 / 未设工作区 → 状态栏提示
 *   - ignored(javascript: 等)→ 仅 preventDefault,无 service 调用
 *
 * mock 惯例与 PreviewPane.test.ts(vi.mock + 手动放回 Tauri 标志)及
 * externalLinks.test.ts(forceTauri)保持一致。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const renderMarkdownMock = vi.fn(async (_src: string) => '')
const openDiagramWindowMock = vi.fn(async (_opts: unknown): Promise<boolean> => true)
const canOpenInWindowMock = vi.fn(() => true)
const openExternalMock = vi.fn(async (_target: string): Promise<void> => {})
const readTextFileMock = vi.fn(async (_path: string): Promise<string> => '# mock')
const allowWorkspaceDirMock = vi.fn(async (_path: string): Promise<void> => {})
const watchFileExternalMock = vi.fn(async (_path: string): Promise<null> => null)
const unwatchFileExternalMock = vi.fn(async (): Promise<null> => null)

vi.mock('@/markdown/pipeline', () => ({
  renderMarkdown: (src: string) => renderMarkdownMock(src),
}))
vi.mock('@/services/diagramWindow', () => ({
  canOpenInWindow: () => canOpenInWindowMock(),
  openDiagramWindow: (opts: unknown) => openDiagramWindowMock(opts),
}))
vi.mock('@/services/externalLinks', () => ({
  openExternal: (target: string) => openExternalMock(target),
}))
// 部分mock:readTextFile(文档跳转读盘)与 watch 系(Tauri 模式下 store 会在
// activeTabPath 变化时挂监听)替换为可控 mock,其余保留原实现。
// allowWorkspaceDir(bugfix-005)同样替换:真实现走 @tauri-apps/api/core
// 动态导入,首次模块加载超出 flushPromises 的冲刷范围。
vi.mock('@/services/fileService', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    readTextFile: (path: string) => readTextFileMock(path),
    allowWorkspaceDir: (path: string) => allowWorkspaceDirMock(path),
    watchFileExternal: (path: string) => watchFileExternalMock(path),
    unwatchFileExternal: () => unwatchFileExternalMock(),
  }
})

import { useWorkspaceStore } from '@/stores/workspace'
import PreviewPane from '@/components/PreviewPane.vue'

function forceTauri(on: boolean) {
  if (on) {
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
  } else {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  }
}

const scrollIntoViewMock = vi.fn()

beforeEach(() => {
  setActivePinia(createPinia())
  forceTauri(false)
  openExternalMock.mockReset()
  openExternalMock.mockResolvedValue(undefined)
  readTextFileMock.mockReset()
  readTextFileMock.mockResolvedValue('# mock')
  renderMarkdownMock.mockReset()
  renderMarkdownMock.mockResolvedValue('')
  scrollIntoViewMock.mockReset()
  // jsdom 未实现 scrollIntoView,挂 spy 到 Element 原型(vitest 每文件独立环境)
  ;(Element.prototype as unknown as Record<string, unknown>).scrollIntoView =
    scrollIntoViewMock
  document.body.innerHTML = ''
})

afterEach(() => {
  forceTauri(false)
  vi.restoreAllMocks()
  // scrollIntoView 是手动挂到原型上的,restoreAllMocks 不覆盖,手动摘除
  delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView
})

async function mountPaneWith(renderedHtml: string, tabPath = 'D:\\docs\\index.md') {
  renderMarkdownMock.mockResolvedValue(renderedHtml)
  const ws = useWorkspaceStore()
  ws.upsertTab(tabPath, '# hello')
  const wrapper = mount(PreviewPane, { attachTo: document.body })
  await nextTick()
  await flushPromises()
  return { wrapper, ws }
}

/** 派发可取消的 click 并返回事件对象(供断言 defaultPrevented) */
function clickFirstLink(wrapper: ReturnType<typeof mount>): MouseEvent {
  const a = wrapper.findAll('a')[0].element as HTMLElement
  const event = new MouseEvent('click', { bubbles: true, cancelable: true })
  a.dispatchEvent(event)
  return event
}

describe('PreviewPane 链接路由:anchor 分支', () => {
  it('点击 #锚点(百分号编码中文)→ scrollIntoView smooth/start,defaultPrevented', async () => {
    const { wrapper } = await mountPaneWith(
      '<h2 id="安装">安装</h2><p><a href="#%E5%AE%89%E8%A3%85">跳转</a></p>',
    )
    const event = clickFirstLink(wrapper)
    await nextTick()
    expect(event.defaultPrevented).toBe(true)
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1)
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    })
  })

  it('锚点目标不存在 → 静默忽略(不滚动),仍 preventDefault', async () => {
    const { wrapper } = await mountPaneWith('<p><a href="#不存在">x</a></p>')
    const event = clickFirstLink(wrapper)
    await nextTick()
    expect(event.defaultPrevented).toBe(true)
    expect(scrollIntoViewMock).not.toHaveBeenCalled()
  })
})

describe('PreviewPane 链接路由:external 分支', () => {
  it('点击 http 链接 → openExternal 收到 getAttribute 原值(不剥 fragment),preventDefault', async () => {
    const { wrapper } = await mountPaneWith(
      '<p><a href="https://example.com/a?x=1#f">ext</a></p>',
    )
    const event = clickFirstLink(wrapper)
    await flushPromises()
    expect(event.defaultPrevented).toBe(true)
    expect(openExternalMock).toHaveBeenCalledTimes(1)
    expect(openExternalMock).toHaveBeenCalledWith('https://example.com/a?x=1#f')
  })

  it('openExternal 失败 → 状态栏 error 通知(无法打开链接:...)', async () => {
    openExternalMock.mockRejectedValue(
      'OPEN_EXTERNAL_FAILED: failed to open external target',
    )
    const { wrapper, ws } = await mountPaneWith(
      '<p><a href="https://example.com/">ext</a></p>',
    )
    clickFirstLink(wrapper)
    await flushPromises()
    expect(ws.saveNotice).toEqual({
      level: 'error',
      message: '无法打开链接:failed to open external target',
    })
  })
})

describe('PreviewPane 链接路由:document 分支', () => {
  it('点击 ./note.md(桌面)→ 解析为绝对路径打开新标签,preventDefault', async () => {
    forceTauri(true)
    const { wrapper, ws } = await mountPaneWith(
      '<p><a href="./note.md">doc</a></p>',
      'D:\\docs\\index.md',
    )
    const event = clickFirstLink(wrapper)
    await flushPromises()
    expect(event.defaultPrevented).toBe(true)
    expect(readTextFileMock).toHaveBeenCalledWith('D:\\docs\\note.md')
    expect(ws.tabs.some((t) => t.path === 'D:\\docs\\note.md')).toBe(true)
    expect(ws.activeTabPath).toBe('D:\\docs\\note.md')
  })

  it('中文文件名 href(百分号编码)→ 解码后打开', async () => {
    forceTauri(true)
    const { wrapper, ws } = await mountPaneWith(
      '<p><a href="./%E7%AC%94%E8%AE%B0.md">doc</a></p>',
      'D:\\docs\\index.md',
    )
    clickFirstLink(wrapper)
    await flushPromises()
    expect(ws.tabs.some((t) => t.path === 'D:\\docs\\笔记.md')).toBe(true)
  })

  it('rootPath 未设的 / 开头链接 → 提示未设置工作区,不读盘', async () => {
    forceTauri(true)
    const { wrapper, ws } = await mountPaneWith(
      '<p><a href="/start.md">x</a></p>',
      'D:\\docs\\index.md',
    )
    clickFirstLink(wrapper)
    await flushPromises()
    expect(ws.saveNotice).toEqual({
      level: 'error',
      message: '未设置工作区,无法跳转文档链接',
    })
    expect(readTextFileMock).not.toHaveBeenCalled()
  })

  it('Web 模式点击相对路径 → 提示仅桌面版支持', async () => {
    const { wrapper, ws } = await mountPaneWith('<p><a href="./note.md">doc</a></p>')
    clickFirstLink(wrapper)
    await flushPromises()
    expect(ws.saveNotice).toEqual({
      level: 'error',
      message: '文档间跳转仅桌面版支持',
    })
    expect(readTextFileMock).not.toHaveBeenCalled()
  })

  it('读盘失败(FILE_NOT_FOUND)→ 状态栏错误提示,当前标签不动', async () => {
    forceTauri(true)
    readTextFileMock.mockRejectedValue('FILE_NOT_FOUND: path does not exist')
    const { wrapper, ws } = await mountPaneWith(
      '<p><a href="./missing.md">x</a></p>',
      'D:\\docs\\index.md',
    )
    clickFirstLink(wrapper)
    await flushPromises()
    expect(ws.saveNotice).toEqual({
      level: 'error',
      message: '无法打开链接:path does not exist',
    })
    expect(ws.activeTabPath).toBe('D:\\docs\\index.md')
  })
})

describe('PreviewPane 链接路由:ignored 分支与非链接目标', () => {
  it('javascript: 链接 → 仅 preventDefault,无任何 service 调用', async () => {
    forceTauri(true)
    const { wrapper, ws } = await mountPaneWith(
      '<p><a href="javascript:alert(1)">evil</a></p>',
    )
    const event = clickFirstLink(wrapper)
    await flushPromises()
    expect(event.defaultPrevented).toBe(true)
    expect(openExternalMock).not.toHaveBeenCalled()
    expect(readTextFileMock).not.toHaveBeenCalled()
    expect(ws.saveNotice).toBeNull()
  })

  it('空 href 链接 → ignored,preventDefault 无副作用', async () => {
    const { wrapper, ws } = await mountPaneWith('<p><a href="">x</a></p>')
    const event = clickFirstLink(wrapper)
    await flushPromises()
    expect(event.defaultPrevented).toBe(true)
    expect(openExternalMock).not.toHaveBeenCalled()
    expect(readTextFileMock).not.toHaveBeenCalled()
    expect(ws.saveNotice).toBeNull()
  })

  it('点击非链接区域(如段落)→ 不进路由', async () => {
    const { wrapper, ws } = await mountPaneWith('<p>plain text</p>')
    const p = wrapper.find('p').element as HTMLElement
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    p.dispatchEvent(event)
    await flushPromises()
    expect(event.defaultPrevented).toBe(false)
    expect(ws.saveNotice).toBeNull()
  })
})
