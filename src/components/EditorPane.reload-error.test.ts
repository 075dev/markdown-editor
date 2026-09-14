import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import EditorPane from '@/components/EditorPane.vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { readTextFile } from '@/services/fileService'
import type { QlError } from '@/services/errors'

/**
 * 交接备注 #3 的消费端保护:onReload 里 readTextFile 抛 QlError 时
 *   - 不得产生 unhandled rejection(静默,不弹窗)
 *   - 编辑器内容保持不变
 *   - 状态条短暂可感(data-testid="editor-reload-error"),4s 自动消失
 */

vi.mock('@/services/fileService', async () => {
  const actual = await vi.importActual<typeof import('@/services/fileService')>(
    '@/services/fileService',
  )
  return {
    ...actual,
    saveMarkdownFile: vi.fn(async (_c: string, path?: string) => ({ path: path ?? 'm.md' })),
    watchFileExternal: vi.fn(async () => null),
    unwatchFileExternal: vi.fn(async () => {}),
    readTextFile: vi.fn(async () => null),
  }
})

vi.mock('@/editor/createEditor', () => ({
  createMarkdownEditor: vi.fn(() => ({
    setValue: vi.fn(),
    applyTheme: vi.fn(),
    getScrollElement: () => null,
    destroy: vi.fn(),
  })),
}))

const readMock = vi.mocked(readTextFile)

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  readMock.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

function mountPane() {
  const ws = useWorkspaceStore()
  ws.upsertTab('/a/demo.md', 'old content')
  ws.activeTabPath = '/a/demo.md'
  const wrapper = mount(EditorPane)
  return { wrapper, ws }
}

function fireReload(path = '/a/demo.md') {
  window.dispatchEvent(new CustomEvent('mde:reload-tab', { detail: { path } }))
}

describe('EditorPane.onReload 读盘失败保护', () => {
  it('readTextFile 抛 QlError → 不上抛,状态条显示,编辑器内容不变', async () => {
    const { wrapper, ws } = mountPane()
    const qlErr: QlError = { code: 'FILE_NOT_FOUND', message: 'no such file' }
    readMock.mockRejectedValue(qlErr)

    expect(() => {
      fireReload()
    }).not.toThrow()
    await flushPromises()

    const strip = wrapper.find('[data-testid="editor-reload-error"]')
    expect(strip.exists()).toBe(true)
    expect(strip.text()).toContain('文件重载失败')
    expect(strip.text()).toContain('no such file')
    // 编辑器内容保持不变(未执行 setValue 刷新)
    expect(ws.activeTab?.content).toBe('old content')
  })

  it('状态条 4 秒后自动消失(不弹窗、不留常驻元素)', async () => {
    const { wrapper } = mountPane()
    readMock.mockRejectedValue({ code: 'FILE_READ_FAILED', message: 'locked' })
    fireReload()
    await flushPromises()
    expect(wrapper.find('[data-testid="editor-reload-error"]').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(4000)
    expect(wrapper.find('[data-testid="editor-reload-error"]').exists()).toBe(false)
  })

  it('读盘成功路径不受影响:内容刷新、无状态条', async () => {
    const { wrapper, ws } = mountPane()
    readMock.mockResolvedValue('fresh from disk')
    fireReload()
    await flushPromises()
    expect(wrapper.find('[data-testid="editor-reload-error"]').exists()).toBe(false)
    expect(ws.activeTab?.content).toBe('fresh from disk')
    expect(ws.activeTab?.savedContent).toBe('fresh from disk')
  })
})
