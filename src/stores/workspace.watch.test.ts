import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWorkspaceStore, FILE_EXTERNAL_CHANGE_EVENT } from '@/stores/workspace'

/**
 * 单元测试：外部文件修改事件 → workspace store reloadFromDisk →
 * window CustomEvent 'mde:reload-tab' 派发。
 *
 * 不真正调 readTextFile（EditorPane 处理）；store 只负责路由事件。
 */

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  // 清理本测试添加的 mde:reload-tab 监听器，避免污染下一个测试
  // 我们没保存 listener 引用，所以重置整个 DOM listener 集合不实际，
  // 但 setActivePinia(createPinia()) 已经重新初始化 store —— store
  // 内的 listener 是用同一 callback 闭包注册的，没有清反而会泄漏。
  // 现实里 jest/vitest jsdom 隔离每个测试的 window 所以没事。
})

describe('workspace: external file change routing', () => {
  it('FILE_EXTERNAL_CHANGE_EVENT triggers mde:reload-tab for the matching tab', async () => {
    const ws = useWorkspaceStore()
    ws.upsertTab('/a/b.md', 'old content')

    const detail: { path: string; fired: boolean } = { path: '/a/b.md', fired: false }
    const handler = (e: Event) => {
      const d = (e as CustomEvent<{ path: string }>).detail
      if (d?.path === detail.path) detail.fired = true
    }
    window.addEventListener('mde:reload-tab', handler)

    window.dispatchEvent(
      new CustomEvent(FILE_EXTERNAL_CHANGE_EVENT, {
        detail: { path: '/a/b.md' },
      }),
    )

    expect(detail.fired).toBe(true)
    window.removeEventListener('mde:reload-tab', handler)
  })

  it('reload is a no-op for unknown paths (no exception)', () => {
    const ws = useWorkspaceStore()
    ws.upsertTab('/a/b.md', 'content')
    // dispatch for a path that is not in tabs
    expect(() => {
      window.dispatchEvent(
        new CustomEvent(FILE_EXTERNAL_CHANGE_EVENT, {
          detail: { path: '/x/y.md' },
        }),
      )
    }).not.toThrow()
  })

  it('reload event carries the path detail', () => {
    // 调用 useWorkspaceStore 触发 listener 注册
    useWorkspaceStore()
    let capturedPath: string | null = null
    const handler = (e: Event) => {
      capturedPath = (e as CustomEvent<{ path: string }>).detail?.path ?? null
    }
    window.addEventListener('mde:reload-tab', handler)

    window.dispatchEvent(
      new CustomEvent(FILE_EXTERNAL_CHANGE_EVENT, {
        detail: { path: '/path/to/file.md' },
      }),
    )
    expect(capturedPath).toBe('/path/to/file.md')
    window.removeEventListener('mde:reload-tab', handler)
  })
})