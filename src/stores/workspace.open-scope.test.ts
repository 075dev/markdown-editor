/**
 * 文件打开链路·fs scope 运行时授权(bugfix-005)回归测试。
 *
 * 缺陷:文件关联双击/暖启动/链接跳转经 openFileFromPath 打开的文件——
 * 读盘走自定义 command read_file(不走 fs:scope)能正常打开,但保存走
 * plugin-fs writeTextFile(受 fs:scope 限制)。这类路径既没经过对话框
 * (plugin-dialog 选定后自动 allow_file)也没经过 chooseWorkspace 的
 * allow_workspace_dir 放行,Ctrl+S/自动保存一律 forbidden
 * (FILE_WRITE_FAILED),表现为「文件能打开但无法保存」。
 *
 * 修复:openFileFromPath 在读盘前对目标路径做运行时授权;授权失败
 * 不阻断打开(读不受影响,保存失败由既有 saveNotice 链路呈现)。
 *
 * mock 下沉到 @tauri-apps/api/core 与 event 桥,走真实 store → fileService
 * → invoke 链路(与 workspace.tree-scope.test.ts 同模式)。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => invokeMock(cmd, args),
}))
// openFileFromPath 成功后 activeTabPath 变化,store 会建文件监听;
// mock 掉 event.listen 避免真实 IPC 桥在 jsdom 下未定义行为。
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => {}),
}))

import { useWorkspaceStore } from '@/stores/workspace'

function forceTauri(on: boolean) {
  if (on) {
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
  } else {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  forceTauri(true)
  invokeMock.mockReset()
  invokeMock.mockImplementation((cmd: string) => {
    if (cmd === 'read_file') return Promise.resolve('# 探针内容\n')
    return Promise.resolve(null)
  })
})

describe('openFileFromPath 的 fs scope 运行时授权(bugfix-005)', () => {
  it('读盘前先授权目标路径(invoke allow_workspace_dir),文件正常打开', async () => {
    const ws = useWorkspaceStore()

    const ok = await ws.openFileFromPath('D:\\notes\\demo.md')

    expect(ok).toBe(true)
    expect(invokeMock).toHaveBeenCalledWith('allow_workspace_dir', {
      path: 'D:\\notes\\demo.md',
    })
    // 授权先于读盘:保存链路(writeTextFile)依赖打开时已放行
    const allowIdx = invokeMock.mock.calls.findIndex(
      (c) => c[0] === 'allow_workspace_dir',
    )
    const readIdx = invokeMock.mock.calls.findIndex((c) => c[0] === 'read_file')
    expect(allowIdx).toBeGreaterThanOrEqual(0)
    expect(readIdx).toBeGreaterThan(allowIdx)
    expect(ws.tabs[0]?.content).toBe('# 探针内容\n')
  })

  it('授权失败不阻断打开(读盘走自定义 command 不受 scope 限制)', async () => {
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'allow_workspace_dir') {
        throw new Error('INTERNAL_ERROR: allow fs scope failed')
      }
      if (cmd === 'read_file') return '# 探针内容\n'
      return null
    })
    const ws = useWorkspaceStore()

    const ok = await ws.openFileFromPath('D:\\notes\\demo.md')

    expect(ok).toBe(true)
    expect(ws.tabs[0]?.content).toBe('# 探针内容\n')
  })
})
