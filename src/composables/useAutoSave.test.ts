import { describe, expect, it, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSettingsStore } from '@/stores/settings'
import { useAutoSave, AUTOSAVE_DEBOUNCE_MS } from '@/composables/useAutoSave'
import { saveMarkdownFile } from '@/services/fileService'

vi.mock('@/services/fileService', async () => {
  const actual = await vi.importActual<typeof import('@/services/fileService')>(
    '@/services/fileService',
  )
  return {
    ...actual,
    saveMarkdownFile: vi.fn(async (_content: string, path?: string) => ({
      path: path ?? 'mocked.md',
    })),
    watchFileExternal: vi.fn(async () => null),
    unwatchFileExternal: vi.fn(async () => {}),
    readTextFile: vi.fn(async () => null),
  }
})

const saveMock = vi.mocked(saveMarkdownFile)

beforeEach(() => {
  vi.useFakeTimers()
  saveMock.mockClear()
  setActivePinia(createPinia())
})

function setup() {
  const scope = effectScope()
  const api = scope.run(() => {
    const ws = useWorkspaceStore()
    const settings = useSettingsStore()
    const autosave = useAutoSave({ debounceMs: AUTOSAVE_DEBOUNCE_MS })
    return { ws, settings, autosave }
  })!
  return api
}

describe('useAutoSave(骨架)', () => {
  it('exports the 1500ms default debounce', () => {
    expect(AUTOSAVE_DEBOUNCE_MS).toBe(1500)
  })

  it('autoSaveEnabled=false 时内容变更完全不触发保存', async () => {
    const { ws, settings } = setup()
    settings.setAutoSaveEnabled(false)
    ws.upsertTab('/a/demo.md', 'hello')
    ws.updateActiveContent('hello world')
    await vi.advanceTimersByTimeAsync(5000)
    expect(saveMock).not.toHaveBeenCalled()
  })

  it('内容变更后 1500ms 防抖触发一次 saveActive', async () => {
    const { ws, settings } = setup()
    settings.setAutoSaveEnabled(true)
    ws.upsertTab('/a/demo.md', 'hello')
    ws.updateActiveContent('hello world')
    // 未到防抖时间:不保存
    await vi.advanceTimersByTimeAsync(1400)
    expect(saveMock).not.toHaveBeenCalled()
    // 到点:保存一次
    await vi.advanceTimersByTimeAsync(200)
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(saveMock).toHaveBeenCalledWith('hello world', '/a/demo.md')
  })

  it('防抖窗口内连续输入只保存最后一次', async () => {
    const { ws, settings } = setup()
    settings.setAutoSaveEnabled(true)
    ws.upsertTab('/a/demo.md', 'v1')
    ws.updateActiveContent('v2')
    await vi.advanceTimersByTimeAsync(1000)
    ws.updateActiveContent('v3 final')
    await vi.advanceTimersByTimeAsync(1400)
    expect(saveMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(200)
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(saveMock).toHaveBeenLastCalledWith('v3 final', '/a/demo.md')
  })

  it('Conflict 标签不触发自动保存(暂停语义)', async () => {
    const { ws, settings } = setup()
    settings.setAutoSaveEnabled(true)
    ws.upsertTab('/a/demo.md', 'base')
    ws.updateActiveContent('my edit')
    // 模拟外部修改把标签打进 Conflict
    window.dispatchEvent(
      new CustomEvent('mde:file-external-change', { detail: { path: '/a/demo.md' } }),
    )
    const tab = ws.tabs.find((t) => t.path === '/a/demo.md')!
    expect(tab.status).toBe('conflict')
    ws.updateActiveContent('my edit v2')
    await vi.advanceTimersByTimeAsync(5000)
    expect(saveMock).not.toHaveBeenCalled()
  })

  it('保存成功后标签回到 Clean;再次编辑开启新一轮防抖', async () => {
    const { ws, settings } = setup()
    settings.setAutoSaveEnabled(true)
    ws.upsertTab('/a/demo.md', 'base')
    ws.updateActiveContent('edit 1')
    await vi.advanceTimersByTimeAsync(1600)
    expect(saveMock).toHaveBeenCalledTimes(1)
    const tab = ws.tabs.find((t) => t.path === '/a/demo.md')!
    expect(tab.status).toBe('clean')
    ws.updateActiveContent('edit 2')
    expect(tab.status).toBe('dirty')
    await vi.advanceTimersByTimeAsync(1600)
    expect(saveMock).toHaveBeenCalledTimes(2)
  })

  it('手动调用 cancelPending 取消未触发的保存', async () => {
    const { ws, settings, autosave } = setup()
    settings.setAutoSaveEnabled(true)
    ws.upsertTab('/a/demo.md', 'base')
    ws.updateActiveContent('edit')
    // watch 回调是异步 flush:先冲微任务让防抖 timer 真正建立
    await vi.advanceTimersByTimeAsync(0)
    autosave.cancelPending()
    await vi.advanceTimersByTimeAsync(5000)
    expect(saveMock).not.toHaveBeenCalled()
  })
})
