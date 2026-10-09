import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HomeView from '@/views/HomeView.vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSettingsStore } from '@/stores/settings'
import { saveMarkdownFile } from '@/services/fileService'
import { AUTOSAVE_DEBOUNCE_MS } from '@/composables/useAutoSave'

/**
 * 装配级回归测试(评审 round 1 C1 修复):
 *   useAutoSave 此前从未在生产代码中装配(仅测试直接实例化),
 *   本文件锁定「HomeView 挂载后自动保存真实生效」这一装配事实:
 *     - 开关开启:编辑内容越过防抖窗口 → saveMarkdownFile 被调
 *     - 开关关闭:编辑内容不写盘(autoSaveEnabled 不是 no-op)
 *     - HomeView 卸载:挂起的防抖定时器随组件清理(onScopeDispose)
 */

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/services/fileService', async () => {
  const actual = await vi.importActual<typeof import('@/services/fileService')>(
    '@/services/fileService',
  )
  return {
    ...actual,
    saveMarkdownFile: vi.fn(async (_c: string, path?: string) => ({
      path: path ?? 'm.md',
    })),
    watchFileExternal: vi.fn(async () => null),
    unwatchFileExternal: vi.fn(async () => {}),
    readTextFile: vi.fn(async () => null),
  }
})

const saveMock = vi.mocked(saveMarkdownFile)

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  saveMock.mockReset()
  saveMock.mockImplementation(async (_c: string, path?: string) => ({
    path: path ?? 'm.md',
  }))
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.useRealTimers()
})

function mountHome() {
  return mount(HomeView, {
    global: {
      stubs: {
        TitleBar: true,
        Sidebar: true,
        EditorPane: true,
        PreviewPane: true,
        AutoSaveBanner: true,
      },
    },
  })
}

describe('HomeView 装配 useAutoSave(C1 装配级回归)', () => {
  it('开关开启:编辑后越过 1500ms 防抖 → saveMarkdownFile 被调(装配生效)', async () => {
    const wrapper = mountHome()
    const ws = useWorkspaceStore()
    const settings = useSettingsStore()
    settings.setAutoSaveEnabled(true)
    ws.upsertTab('/a/demo.md', 'hello')
    ws.updateActiveContent('hello world')
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS + 100)
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(saveMock).toHaveBeenCalledWith('hello world', '/a/demo.md')
    wrapper.unmount()
  })

  it('开关关闭:编辑后不写盘(autoSaveEnabled 在生产装配中真实生效)', async () => {
    const wrapper = mountHome()
    const ws = useWorkspaceStore()
    const settings = useSettingsStore()
    settings.setAutoSaveEnabled(false)
    ws.upsertTab('/a/demo.md', 'hello')
    ws.updateActiveContent('hello world')
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS + 100)
    expect(saveMock).not.toHaveBeenCalled()
    expect(ws.tabs[0].status).toBe('dirty')
    wrapper.unmount()
  })

  it('HomeView 卸载后:挂起的防抖定时器随组件清理,不再写盘', async () => {
    const wrapper = mountHome()
    const ws = useWorkspaceStore()
    const settings = useSettingsStore()
    settings.setAutoSaveEnabled(true)
    ws.upsertTab('/a/demo.md', 'hello')
    ws.updateActiveContent('hello world')
    await vi.advanceTimersByTimeAsync(0) // 让 watch 建立防抖定时器
    wrapper.unmount() // onScopeDispose:cancelPending + 注销 blur 监听
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS + 100)
    expect(saveMock).not.toHaveBeenCalled()
  })
})
