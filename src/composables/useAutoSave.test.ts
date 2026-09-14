import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope, type EffectScope } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSettingsStore } from '@/stores/settings'
import {
  useAutoSave,
  AUTOSAVE_DEBOUNCE_MS,
  AUTOSAVE_RETRY_DELAYS_MS,
  hashContent,
} from '@/composables/useAutoSave'
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

/** blur listener 挂在 window 上:必须随 scope.stop() 注销,否则跨用例泄漏 */
const scopes: EffectScope[] = []

beforeEach(() => {
  vi.useFakeTimers()
  saveMock.mockReset()
  saveMock.mockImplementation(async (_content: string, path?: string) => ({
    path: path ?? 'mocked.md',
  }))
  setActivePinia(createPinia())
})

afterEach(() => {
  while (scopes.length) scopes.pop()?.stop()
  vi.useRealTimers()
})

function setup() {
  const scope = effectScope()
  scopes.push(scope)
  const api = scope.run(() => {
    const ws = useWorkspaceStore()
    const settings = useSettingsStore()
    const autosave = useAutoSave({ debounceMs: AUTOSAVE_DEBOUNCE_MS })
    return { ws, settings, autosave }
  })!
  return api
}

function dirtyTab(ws: ReturnType<typeof useWorkspaceStore>, path: string, edited: string) {
  const tab = ws.tabs.find((t) => t.path === path)!
  expect(tab.status).toBe('dirty')
  expect(tab.content).toBe(edited)
  return tab
}

function fireBlur() {
  window.dispatchEvent(new Event('blur'))
}

function writeFail(code = 'FILE_WRITE_FAILED', message = 'Access is denied') {
  saveMock.mockRejectedValue(`${code}: ${message}`)
}

describe('useAutoSave(核心:防抖/开关/状态门控)', () => {
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

describe('useAutoSave(填充态:hash 变化检测)', () => {
  it('hashContent:等长不同内容指纹不同,相同内容指纹一致', () => {
    expect(hashContent('aaaa')).not.toBe(hashContent('bbbb'))
    expect(hashContent('same')).toBe(hashContent('same'))
    expect(hashContent('')).toBe('811c9dc5')
  })

  it('等长替换也触发自动保存(交接备注 #4:length 近似 → hash)', async () => {
    const { ws, settings } = setup()
    settings.setAutoSaveEnabled(true)
    ws.upsertTab('/a/demo.md', 'aaaa')
    ws.updateActiveContent('bbbb') // 与 'aaaa' 等长
    await vi.advanceTimersByTimeAsync(1600)
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(saveMock).toHaveBeenCalledWith('bbbb', '/a/demo.md')
  })
})

describe('useAutoSave(填充态:指数退避重试,1s/2s/4s 共 3 次)', () => {
  it('retry delays 契约常量正确', () => {
    expect([...AUTOSAVE_RETRY_DELAYS_MS]).toEqual([1000, 2000, 4000])
  })

  it('写盘失败按 1s/2s 重试,第 3 次成功 → Clean + info 通知', async () => {
    const { ws, settings } = setup()
    settings.setAutoSaveEnabled(true)
    ws.upsertTab('/a/demo.md', 'base')
    ws.updateActiveContent('my edit')
    saveMock
      .mockRejectedValueOnce('FILE_WRITE_FAILED: locked 1')
      .mockRejectedValueOnce('FILE_WRITE_FAILED: locked 2')
      .mockResolvedValueOnce({ path: '/a/demo.md' })

    await vi.advanceTimersByTimeAsync(1600) // 防抖到点 → 失败 #1
    dirtyTab(ws, '/a/demo.md', 'my edit')
    expect(saveMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1000) // +1s 重试 → 失败 #2
    expect(saveMock).toHaveBeenCalledTimes(2)
    expect(ws.tabs[0].status).toBe('dirty')

    await vi.advanceTimersByTimeAsync(2000) // +2s 重试 → 成功
    expect(saveMock).toHaveBeenCalledTimes(3)
    expect(ws.tabs[0].status).toBe('clean')
    expect(ws.saveNotice?.level).toBe('info')
    expect(ws.saveNotice?.message).toContain('已恢复')
  })

  it('3 次重试均失败 → 保持 Dirty + error 通知,停止本轮(不再有定时器)', async () => {
    const { ws, settings } = setup()
    settings.setAutoSaveEnabled(true)
    ws.upsertTab('/a/demo.md', 'base')
    ws.updateActiveContent('my edit')
    writeFail()

    await vi.advanceTimersByTimeAsync(1600) // 初始失败
    await vi.advanceTimersByTimeAsync(1000) // 重试 1
    await vi.advanceTimersByTimeAsync(2000) // 重试 2
    await vi.advanceTimersByTimeAsync(4000) // 重试 3
    expect(saveMock).toHaveBeenCalledTimes(4) // 1 初始 + 3 重试

    // 重试用尽:推进很远也不会再调用
    await vi.advanceTimersByTimeAsync(60000)
    expect(saveMock).toHaveBeenCalledTimes(4)
    dirtyTab(ws, '/a/demo.md', 'my edit') // 保持 Dirty
    expect(ws.saveNotice?.level).toBe('error')
    expect(ws.saveNotice?.message).toContain('已停止本轮重试')
  })

  it('重试期间继续编辑,重试保存的是最新内容且不中断', async () => {
    const { ws, settings } = setup()
    settings.setAutoSaveEnabled(true)
    ws.upsertTab('/a/demo.md', 'base')
    ws.updateActiveContent('edit v1')
    saveMock.mockRejectedValueOnce('FILE_WRITE_FAILED: busy').mockResolvedValue({ path: '/a/demo.md' })

    await vi.advanceTimersByTimeAsync(1600) // 失败 #1,进入重试链
    expect(saveMock).toHaveBeenCalledTimes(1)
    ws.updateActiveContent('edit v2') // 重试等待期继续编辑(新一轮防抖)
    await vi.advanceTimersByTimeAsync(1000) // 重试成功(最新内容)
    expect(saveMock).toHaveBeenCalledTimes(2)
    expect(saveMock).toHaveBeenLastCalledWith('edit v2', '/a/demo.md')
  })

  it('不可重试错误(PATH_INVALID)不进入重试链,保持 Dirty', async () => {
    const { ws, settings } = setup()
    settings.setAutoSaveEnabled(true)
    ws.upsertTab('/a/demo.md', 'base')
    ws.updateActiveContent('edit')
    writeFail('PATH_INVALID', 'bad path')

    await vi.advanceTimersByTimeAsync(1600)
    expect(saveMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(10000)
    expect(saveMock).toHaveBeenCalledTimes(1) // 无重试
    dirtyTab(ws, '/a/demo.md', 'edit')
    expect(ws.saveNotice?.level).toBe('error')
    expect(ws.lastSaveError?.code).toBe('PATH_INVALID')
  })

  it('FILE_READ_FAILED 也属于可重试错误码', async () => {
    const { ws, settings } = setup()
    settings.setAutoSaveEnabled(true)
    ws.upsertTab('/a/demo.md', 'base')
    ws.updateActiveContent('edit')
    saveMock.mockRejectedValueOnce('FILE_READ_FAILED: fs broken').mockResolvedValue({ path: '/a/demo.md' })

    await vi.advanceTimersByTimeAsync(1600)
    expect(saveMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(saveMock).toHaveBeenCalledTimes(2) // 1s 后重试了
    expect(ws.tabs[0].status).toBe('clean')
  })
})

describe('useAutoSave(填充态:窗口失焦立即保存)', () => {
  it('blur:取消防抖,立即顺序保存全部 Dirty 标签(顺序、互不阻断)', async () => {
    const { ws, settings } = setup()
    settings.setAutoSaveEnabled(true)
    ws.upsertTab('/a/one.md', 'one')
    ws.updateActiveContent('one v2')
    ws.upsertTab('/a/two.md', 'two')
    ws.updateActiveContent('two v2')

    fireBlur()
    await vi.advanceTimersByTimeAsync(0)
    expect(saveMock).toHaveBeenCalledTimes(2)
    expect(saveMock.mock.calls[0]).toEqual(['one v2', '/a/one.md'])
    expect(saveMock.mock.calls[1]).toEqual(['two v2', '/a/two.md'])
    expect(ws.tabs.every((t) => t.status === 'clean')).toBe(true)
  })

  it('blur 时一个标签失败(可重试),其余仍保存,失败者进重试链后恢复', async () => {
    const { ws, settings } = setup()
    settings.setAutoSaveEnabled(true)
    ws.upsertTab('/a/one.md', 'one')
    ws.updateActiveContent('one v2')
    ws.upsertTab('/a/two.md', 'two')
    ws.updateActiveContent('two v2')
    // 仅 one.md 首次写失败(重试轮成功)
    let oneFailures = 0
    saveMock.mockImplementation(async (_content: string, path?: string) => {
      if (path === '/a/one.md' && oneFailures++ === 0) {
        throw 'FILE_WRITE_FAILED: busy'
      }
      return { path: path ?? 'x.md' }
    })

    fireBlur()
    await vi.advanceTimersByTimeAsync(0)
    expect(saveMock).toHaveBeenCalledTimes(2) // one 失败,two 成功
    expect(ws.tabs.find((t) => t.path === '/a/two.md')!.status).toBe('clean')
    expect(ws.tabs.find((t) => t.path === '/a/one.md')!.status).toBe('dirty')

    await vi.advanceTimersByTimeAsync(1000) // 重试轮:one.md 恢复
    expect(saveMock).toHaveBeenCalledTimes(3)
    expect(ws.tabs.find((t) => t.path === '/a/one.md')!.status).toBe('clean')
    expect(ws.saveNotice?.level).toBe('info')
  })

  it('autoSaveEnabled=false 时 blur 也不保存(边缘场景 9:全部自动保存停用)', async () => {
    const { ws, settings } = setup()
    settings.setAutoSaveEnabled(false)
    ws.upsertTab('/a/demo.md', 'base')
    ws.updateActiveContent('edit')
    fireBlur()
    await vi.advanceTimersByTimeAsync(5000)
    expect(saveMock).not.toHaveBeenCalled()
    dirtyTab(ws, '/a/demo.md', 'edit')
  })

  it('blur 时不保存 untitled(无路径)标签', async () => {
    const { ws, settings } = setup()
    settings.setAutoSaveEnabled(true)
    ws.upsertTab('/a/real.md', 'real')
    ws.updateActiveContent('real v2') // 有路径标签保持 Dirty
    ws.tabs.push({
      path: '',
      name: 'untitled.md',
      content: 'draft',
      savedContent: '',
      status: 'dirty',
    })
    fireBlur()
    await vi.advanceTimersByTimeAsync(0)
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(saveMock).toHaveBeenCalledWith('real v2', '/a/real.md')
  })

  it('untitled(无路径)标签不参与防抖自动保存(边缘场景 5)', async () => {
    const { ws, settings } = setup()
    settings.setAutoSaveEnabled(true)
    ws.upsertTab('/a/real.md', 'real')
    ws.tabs.push({
      path: '',
      name: 'untitled.md',
      content: 'draft',
      savedContent: '',
      status: 'dirty',
    })
    ws.activeTabPath = '' // untitled 为活动标签
    ws.tabs.find((t) => t.path === '')! // 存在性确认
    const untitled = ws.tabs[ws.tabs.length - 1]
    untitled.content = 'draft v2'
    await vi.advanceTimersByTimeAsync(5000)
    expect(saveMock).not.toHaveBeenCalled()
    expect(untitled.status).toBe('dirty')
  })
})
