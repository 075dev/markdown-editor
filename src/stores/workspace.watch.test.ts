import { describe, expect, it, beforeAll, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWorkspaceStore, FILE_EXTERNAL_CHANGE_EVENT } from '@/stores/workspace'
import { useSettingsStore } from '@/stores/settings'
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

function dispatchExternalChangeKind(
  path: string,
  kind: 'modified' | 'removed',
) {
  window.dispatchEvent(
    new CustomEvent(FILE_EXTERNAL_CHANGE_EVENT, { detail: { path, kind } }),
  )
}

describe('workspace: kind=removed 外部删除(填充阶段 T2)', () => {
  it('Clean 标签收到 removed → 直接 Conflict,不派发 reload,内容保留', () => {
    // 共享单例 store(见文件头说明)
    ws.upsertTab('/a/gone.md', 'precious content')
    const tracker = trackReloadEvents()

    dispatchExternalChangeKind('/a/gone.md', 'removed')

    const tab = ws.tabs.find((t) => t.path === '/a/gone.md')!
    expect(tab.status).toBe('conflict')
    expect(tab.conflictKind).toBe('removed')
    expect(tab.content).toBe('precious content')
    expect(tracker.fired).toEqual([]) // 磁盘已无内容,不走重载
  })

  it('Dirty 标签收到 removed → Conflict(removed),本地未保存内容保留', () => {
    ws.upsertTab('/a/gone2.md', 'saved')
    ws.updateActiveContent('my unsaved work')
    dispatchExternalChangeKind('/a/gone2.md', 'removed')
    const tab = ws.tabs.find((t) => t.path === '/a/gone2.md')!
    expect(tab.status).toBe('conflict')
    expect(tab.conflictKind).toBe('removed')
    expect(tab.content).toBe('my unsaved work')
  })

  it('Conflict 态收到 removed → 忽略(不覆盖用户决策前的任何一侧)', () => {
    ws.upsertTab('/a/c.md', 'saved')
    ws.updateActiveContent('mine')
    dispatchExternalChangeKind('/a/c.md', 'modified')
    const tab = ws.tabs.find((t) => t.path === '/a/c.md')!
    expect(tab.status).toBe('conflict')

    const tracker = trackReloadEvents()
    dispatchExternalChangeKind('/a/c.md', 'removed')
    expect(tab.status).toBe('conflict')
    expect(tab.content).toBe('mine')
    expect(tracker.fired).toEqual([])
  })

  it('removed 后「保留我的」→ 重新写盘恢复为 Clean 并清空 conflictKind', async () => {
    ws.upsertTab('/a/gone3.md', 'disk gone')
    ws.updateActiveContent('my recovery version')
    dispatchExternalChangeKind('/a/gone3.md', 'removed')
    const tab = ws.tabs.find((t) => t.path === '/a/gone3.md')!
    expect(tab.conflictKind).toBe('removed')

    const ok = await ws.resolveConflictKeepMine()
    expect(ok).toBe(true)
    expect(tab.status).toBe('clean')
    expect(tab.conflictKind).toBeUndefined()
    expect(tab.savedContent).toBe('my recovery version')
  })

  it('modified 决策「用磁盘版本」→ Clean + conflictKind 清除 + reload 派发', () => {
    ws.upsertTab('/a/m.md', 'disk')
    ws.updateActiveContent('mine')
    dispatchExternalChangeKind('/a/m.md', 'modified')
    const tab = ws.tabs.find((t) => t.path === '/a/m.md')!
    expect(tab.conflictKind).toBe('modified')
    const tracker = trackReloadEvents()
    expect(ws.resolveConflictUseDisk()).toBe(true)
    expect(tab.status).toBe('clean')
    expect(tab.conflictKind).toBeUndefined()
    expect(tracker.fired).toEqual(['/a/m.md'])
  })
})

describe('workspace: conflict 态关闭标签确认(边缘场景 6,交接备注 #5)', () => {
  it('conflict 标签 closeTab 返回 false(走确认路径,不静默丢数据)', () => {
    ws.upsertTab('/a/x.md', 'saved base')
    ws.updateActiveContent('my edit')
    dispatchExternalChange('/a/x.md')
    const tab = ws.tabs.find((t) => t.path === '/a/x.md')!
    expect(tab.status).toBe('conflict')

    expect(ws.closeTab('/a/x.md')).toBe(false)
    expect(ws.tabs.find((t) => t.path === '/a/x.md')).toBeTruthy()
  })

  it('确认丢弃(forceCloseTab)才真正关闭 conflict 标签', () => {
    ws.upsertTab('/a/y.md', 'saved base')
    ws.updateActiveContent('my edit')
    dispatchExternalChange('/a/y.md')
    expect(ws.tabs.find((t) => t.path === '/a/y.md')!.status).toBe('conflict')

    ws.forceCloseTab('/a/y.md')
    expect(ws.tabs.find((t) => t.path === '/a/y.md')).toBeUndefined()
  })
})

describe('workspace: 冲突安全网独立于自动保存开关(边缘场景 9)', () => {
  it('开关关闭:Dirty 仍进 Conflict、Clean 仍静默重载(安全网仍生效)', () => {
    const settings = useSettingsStore()
    settings.setAutoSaveEnabled(false)
    expect(settings.autoSaveEnabled).toBe(false)

    // Dirty → Conflict
    ws.upsertTab('/a/off1.md', 'saved')
    ws.updateActiveContent('edit with switch off')
    dispatchExternalChange('/a/off1.md')
    expect(ws.tabs.find((t) => t.path === '/a/off1.md')!.status).toBe('conflict')

    // Clean → reload
    ws.upsertTab('/a/off2.md', 'clean content')
    const tracker = trackReloadEvents()
    dispatchExternalChange('/a/off2.md')
    expect(tracker.fired).toEqual(['/a/off2.md'])

    settings.setAutoSaveEnabled(true) // 还原,避免影响后续用例
  })
})
