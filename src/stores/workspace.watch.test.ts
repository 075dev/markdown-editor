import { describe, expect, it, beforeAll, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWorkspaceStore, FILE_EXTERNAL_CHANGE_EVENT } from '@/stores/workspace'
import { readTextFile, saveMarkdownFile } from '@/services/fileService'

/**
 * 单元测试:外部文件修改事件 → workspace 决策(event-flow.md):
 *   Clean → 派发 mde:reload-tab(EditorPane 静默重载)
 *   Dirty → 进入 Conflict,不派发 reload(自动保存暂停)
 *   Conflict → 忽略(等用户决策)
 *   未打开的 path → 忽略
 */

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
    readTextFile: vi.fn(async () => 'disk content'),
  }
})

const readTextFileMock = vi.mocked(readTextFile)

/**
 * 单 pinia 全文件共享:workspace store 会在创建时向 window 注册
 * FILE_EXTERNAL_CHANGE_EVENT listener,重复 setActivePinia 会留下多个
 * 旧实例 listener 同时响应事件,污染 reload 断言。改为一次性建立,
 * 每个测试前手动重置 store 状态。
 */
let ws: ReturnType<typeof useWorkspaceStore>

beforeAll(() => {
  setActivePinia(createPinia())
  ws = useWorkspaceStore()
})

beforeEach(() => {
  readTextFileMock.mockClear()
  vi.mocked(saveMarkdownFile).mockClear()
  ws.tabs = []
  ws.activeTabPath = null
})

function dispatchExternalChange(path: string) {
  window.dispatchEvent(
    new CustomEvent(FILE_EXTERNAL_CHANGE_EVENT, { detail: { path } }),
  )
}

function trackReloadEvents(): { fired: string[] } {
  const fired: string[] = []
  const handler = (e: Event) => {
    const d = (e as CustomEvent<{ path: string }>).detail
    if (d?.path) fired.push(d.path)
  }
  window.addEventListener('mde:reload-tab', handler)
  return {
    get fired() {
      return fired
    },
    // 供测试内断言
    ...({} as Record<string, never>),
  }
}

describe('workspace: external file change decision (status machine)', () => {
  it('Clean 标签 → 派发 mde:reload-tab 静默重载,状态保持 Clean', () => {
    // 共享单例 store(见文件头说明)
    ws.upsertTab('/a/b.md', 'old content')
    const tracker = trackReloadEvents()

    dispatchExternalChange('/a/b.md')

    expect(tracker.fired).toEqual(['/a/b.md'])
    const tab = ws.tabs.find((t) => t.path === '/a/b.md')!
    expect(tab.status).toBe('clean')
  })

  it('Dirty 标签 → 进入 Conflict,不派发 reload(自动保存暂停)', () => {
    // 共享单例 store(见文件头说明)
    ws.upsertTab('/a/b.md', 'saved')
    ws.updateActiveContent('my local edit')
    const tab = ws.tabs.find((t) => t.path === '/a/b.md')!
    expect(tab.status).toBe('dirty')
    const tracker = trackReloadEvents()

    dispatchExternalChange('/a/b.md')

    expect(tracker.fired).toEqual([])
    expect(tab.status).toBe('conflict')
  })

  it('Conflict 标签 → 忽略事件(不覆盖任何一侧,不派发 reload)', () => {
    // 共享单例 store(见文件头说明)
    ws.upsertTab('/a/b.md', 'saved')
    ws.updateActiveContent('my local edit')
    const tab = ws.tabs.find((t) => t.path === '/a/b.md')!
    tab.status = 'conflict'
    const tracker = trackReloadEvents()

    dispatchExternalChange('/a/b.md')

    expect(tracker.fired).toEqual([])
    expect(tab.status).toBe('conflict')
    expect(tab.content).toBe('my local edit')
  })

  it('未打开的 path → 忽略(不异常、不派发)', () => {
    // 共享单例 store(见文件头说明)
    ws.upsertTab('/a/b.md', 'content')
    const tracker = trackReloadEvents()

    expect(() => dispatchExternalChange('/x/y.md')).not.toThrow()
    expect(tracker.fired).toEqual([])
  })

  it('Conflict 态继续编辑保持 Conflict(内容可变,状态不变)', () => {
    // 共享单例 store(见文件头说明)
    ws.upsertTab('/a/b.md', 'saved')
    ws.updateActiveContent('my local edit')
    dispatchExternalChange('/a/b.md')
    ws.updateActiveContent('my local edit v2')
    const tab = ws.tabs.find((t) => t.path === '/a/b.md')!
    expect(tab.status).toBe('conflict')
    expect(tab.content).toBe('my local edit v2')
  })
})

describe('workspace: conflict resolution actions', () => {
  it('resolveConflictKeepMine:覆盖写盘 → Clean(savedContent 同步)', async () => {
    // 共享单例 store(见文件头说明)
    ws.upsertTab('/a/b.md', 'disk version')
    ws.updateActiveContent('my version')
    dispatchExternalChange('/a/b.md')
    const tab = ws.tabs.find((t) => t.path === '/a/b.md')!
    expect(tab.status).toBe('conflict')

    const ok = await ws.resolveConflictKeepMine()

    expect(ok).toBe(true)
    expect(saveMarkdownFile).toHaveBeenCalledTimes(1)
    expect(tab.status).toBe('clean')
    expect(tab.savedContent).toBe('my version')
    expect(tab.content).toBe('my version')
  })

  it('resolveConflictUseDisk:置 Clean 并派发 reload(EditorPane 读盘刷新)', () => {
    // 共享单例 store(见文件头说明)
    ws.upsertTab('/a/b.md', 'disk version')
    ws.updateActiveContent('my version')
    dispatchExternalChange('/a/b.md')
    const tab = ws.tabs.find((t) => t.path === '/a/b.md')!
    expect(tab.status).toBe('conflict')
    const tracker = trackReloadEvents()

    const ok = ws.resolveConflictUseDisk()

    expect(ok).toBe(true)
    expect(tab.status).toBe('clean')
    expect(tracker.fired).toEqual(['/a/b.md'])
  })

  it('非 Conflict 标签调用决策 action 返回 false', async () => {
    // 共享单例 store(见文件头说明)
    ws.upsertTab('/a/b.md', 'content')
    expect(ws.resolveConflictUseDisk()).toBe(false)
    expect(await ws.resolveConflictKeepMine()).toBe(false)
  })

})
