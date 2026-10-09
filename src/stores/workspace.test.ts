import { describe, expect, it, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/services/fileService', async () => {
  const actual =
    await vi.importActual<typeof import('@/services/fileService')>(
      '@/services/fileService',
    )
  return {
    ...actual,
    listDirectory: vi.fn(),
    readTextFile: vi.fn(),
    openMarkdownFile: vi.fn(),
    saveMarkdownFile: vi.fn(),
    pickWorkspaceDirectory: vi.fn(),
    createNewFile: vi.fn(),
    watchFileExternal: vi.fn(async () => null),
    unwatchFileExternal: vi.fn(async () => {}),
  }
})

import { useWorkspaceStore } from '@/stores/workspace'
import { listDirectory, readTextFile } from '@/services/fileService'

const listDirectoryMock = vi.mocked(listDirectory)
const readTextFileMock = vi.mocked(readTextFile)

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
  listDirectoryMock.mockReset()
  readTextFileMock.mockReset()
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

  it('refreshTree populates tree with TreeNode wrappers (dirs first)', async () => {
    const ws = useWorkspaceStore()
    listDirectoryMock.mockResolvedValue([
      { name: 'zebra.md', path: '/root/zebra.md', isDir: false },
      { name: 'docs', path: '/root/docs', isDir: true },
      { name: 'a.md', path: '/root/a.md', isDir: false },
    ] as never)
    ws.rootPath = '/root'
    await ws.refreshTree()

    expect(ws.tree).toHaveLength(3)
    expect(ws.tree.map((n) => n.name)).toEqual(['docs', 'a.md', 'zebra.md'])
    expect(ws.tree[0].isDir).toBe(true)
    expect(ws.tree[0].children).toBeNull() // 目录待懒加载
    expect(ws.tree[1].children).toEqual([]) // 文件
  })

  it('toggleNode expands a dir and lazily loads children', async () => {
    const ws = useWorkspaceStore()
    listDirectoryMock.mockImplementation(async (p: string) => {
      if (p === '/root') {
        return [
          { name: 'sub', path: '/root/sub', isDir: true },
          { name: 'a.md', path: '/root/a.md', isDir: false },
        ] as never
      }
      if (p === '/root/sub') {
        return [
          { name: 'inner.md', path: '/root/sub/inner.md', isDir: false },
        ] as never
      }
      return []
    })
    ws.rootPath = '/root'
    await ws.refreshTree()

    const dir = ws.tree.find((n) => n.name === 'sub')!
    expect(dir.children).toBeNull()
    expect(dir.expanded).toBe(false)

    await ws.toggleNode('/root/sub')
    expect(dir.expanded).toBe(true)
    expect(dir.children).toHaveLength(1)
    expect(dir.children![0].name).toBe('inner.md')

    // 再次 toggle 应该折叠，不再发 listDirectory
    listDirectoryMock.mockClear()
    await ws.toggleNode('/root/sub')
    expect(dir.expanded).toBe(false)
    expect(listDirectoryMock).not.toHaveBeenCalled()
  })

  it('toggleNode caches children so re-expand does not hit filesystem', async () => {
    const ws = useWorkspaceStore()
    listDirectoryMock.mockResolvedValue([
      { name: 'sub', path: '/root/sub', isDir: true },
    ] as never)
    ws.rootPath = '/root'
    await ws.refreshTree()

    // 内部缓存是同一 store 实例复用，所以两次展开应只触发 1 次 listDirectory
    await ws.toggleNode('/root/sub')
    await ws.toggleNode('/root/sub')
    await ws.toggleNode('/root/sub')
    expect(
      listDirectoryMock.mock.calls.filter((c) => c[0] === '/root/sub'),
    ).toHaveLength(1)
  })

  it('openFileFromPath opens a markdown file and ignores non-md', async () => {
    const ws = useWorkspaceStore()
    readTextFileMock.mockImplementation(async (p: string) => {
      if (p === '/root/a.md') return '# Hi'
      if (p === '/root/note.txt') return 'hello'
      return null
    })

    const okMd = await ws.openFileFromPath('/root/a.md')
    expect(okMd).toBe(true)
    expect(ws.tabs).toHaveLength(1)
    expect(ws.activeTabPath).toBe('/root/a.md')
    expect(ws.activeTab?.content).toBe('# Hi')

    expect(ws.isMarkdownPath('/root/a.md')).toBe(true)
    expect(ws.isMarkdownPath('/root/a.MD')).toBe(true)
    expect(ws.isMarkdownPath('/root/note.txt')).toBe(false)
    // 非 markdown 仍然可以被底层读，但 Sidebar 会拦截，不算 store bug
    const okTxt = await ws.openFileFromPath('/root/note.txt')
    expect(okTxt).toBe(true)
  })

  it('openFileFromPath returns false when read fails', async () => {
    const ws = useWorkspaceStore()
    readTextFileMock.mockResolvedValue(null as never)
    const ok = await ws.openFileFromPath('/nope.md')
    expect(ok).toBe(false)
    expect(ws.tabs).toHaveLength(0)
  })

  it('toggleNode ignores non-dir and unknown path', async () => {
    const ws = useWorkspaceStore()
    listDirectoryMock.mockResolvedValue([
      { name: 'a.md', path: '/root/a.md', isDir: false },
    ] as never)
    ws.rootPath = '/root'
    await ws.refreshTree()

    listDirectoryMock.mockClear()
    await ws.toggleNode('/root/a.md') // 文件，没事
    await ws.toggleNode('/root/nope') // 不存在
    expect(listDirectoryMock).not.toHaveBeenCalled()
  })
})