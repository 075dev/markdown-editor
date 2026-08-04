import { describe, expect, it, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWorkspaceStore } from '@/stores/workspace'

/**
 * workspace store 的核心行为：
 *   - upsertTab: 不存在则新建，存在则更新
 *   - isDirty / isTabDirty: content !== savedContent
 *   - closeTab: 干净标签直接关；脏标签返回 false 触发上层确认
 *   - forceCloseTab: 忽略脏状态强制关
 *   - newFile / saveActive / saveAsActive 走 fileService 抽象层
 *
 * fileService 在 jsdom 下走 Web 实现（showOpenFilePicker 等不存在时回退），
 * 这里直接 mock 掉。
 */

interface OpenTab {
  path: string
  name: string
  content: string
  savedContent: string
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('workspace store', () => {
  it('starts with no tabs', () => {
    const ws = useWorkspaceStore()
    expect(ws.tabs).toEqual([])
    expect(ws.activeTabPath).toBeNull()
    expect(ws.isDirty).toBe(false)
  })

  it('upsertTab creates a new tab', () => {
    const ws = useWorkspaceStore()
    ws.upsertTab('/a/b.md', '# Hello')
    expect(ws.tabs).toHaveLength(1)
    expect(ws.activeTabPath).toBe('/a/b.md')
    expect(ws.tabs[0].name).toBe('b.md')
    expect(ws.isDirty).toBe(false)
  })

  it('upsertTab updates existing tab content', () => {
    const ws = useWorkspaceStore()
    ws.upsertTab('/a/b.md', '# v1')
    ws.upsertTab('/a/b.md', '# v2')
    expect(ws.tabs).toHaveLength(1)
    expect(ws.tabs[0].content).toBe('# v2')
    expect(ws.tabs[0].savedContent).toBe('# v2')
  })

  it('updateActiveContent makes tab dirty', () => {
    const ws = useWorkspaceStore()
    ws.upsertTab('/a/b.md', '# Hello')
    ws.updateActiveContent('# World')
    expect(ws.isTabDirty('/a/b.md')).toBe(true)
    expect(ws.isDirty).toBe(true)
  })

  it('closeTab returns true and removes clean tab', () => {
    const ws = useWorkspaceStore()
    ws.upsertTab('/a/b.md', '# Hello')
    const ok = ws.closeTab('/a/b.md')
    expect(ok).toBe(true)
    expect(ws.tabs).toHaveLength(0)
    expect(ws.activeTabPath).toBeNull()
  })

  it('closeTab returns false for dirty tab (上层需 confirm)', () => {
    const ws = useWorkspaceStore()
    ws.upsertTab('/a/b.md', '# Hello')
    ws.updateActiveContent('# edited')
    const ok = ws.closeTab('/a/b.md')
    expect(ok).toBe(false)
    expect(ws.tabs).toHaveLength(1) // 未关闭
  })

  it('forceCloseTab closes dirty tab', () => {
    const ws = useWorkspaceStore()
    ws.upsertTab('/a/b.md', '# Hello')
    ws.updateActiveContent('# edited')
    ws.forceCloseTab('/a/b.md')
    expect(ws.tabs).toHaveLength(0)
  })

  it('closeTab with force:true closes dirty tab directly', () => {
    const ws = useWorkspaceStore()
    ws.upsertTab('/a/b.md', '# Hello')
    ws.updateActiveContent('# edited')
    const ok = ws.closeTab('/a/b.md', { force: true })
    expect(ok).toBe(true)
    expect(ws.tabs).toHaveLength(0)
  })

  it('activateTab switches active tab', () => {
    const ws = useWorkspaceStore()
    ws.upsertTab('/a/a.md', 'A')
    ws.upsertTab('/a/b.md', 'B')
    expect(ws.activeTabPath).toBe('/a/b.md')
    ws.activateTab('/a/a.md')
    expect(ws.activeTabPath).toBe('/a/a.md')
  })

  it('activateTab ignores unknown path', () => {
    const ws = useWorkspaceStore()
    ws.upsertTab('/a/a.md', 'A')
    ws.activateTab('/x/y.md')
    expect(ws.activeTabPath).toBe('/a/a.md')
  })

  it('closeTab switches activeTabPath to remaining tab', () => {
    const ws = useWorkspaceStore()
    ws.upsertTab('/a/a.md', 'A')
    ws.upsertTab('/a/b.md', 'B')
    expect(ws.activeTabPath).toBe('/a/b.md')
    ws.closeTab('/a/b.md')
    expect(ws.activeTabPath).toBe('/a/a.md')
  })

  it('isTabDirty returns false for unknown path', () => {
    const ws = useWorkspaceStore()
    expect(ws.isTabDirty('/x/y.md')).toBe(false)
  })

  it('activeTab reflects activeTabPath', () => {
    const ws = useWorkspaceStore()
    expect(ws.activeTab).toBeNull()
    ws.upsertTab('/a/b.md', 'content')
    const tab = ws.activeTab as OpenTab | null
    expect(tab?.path).toBe('/a/b.md')
  })
})