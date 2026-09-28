/**
 * 工作区文件树·fs scope 运行时授权(bugfix-004)回归测试。
 *
 * 缺陷:capabilities 的 fs:scope 只静态放行 $HOME/$DOCUMENT/$DESKTOP/$DOWNLOAD,
 * 对话框选择的任意位置工作区(如 D:\)在 plugin-fs readDir 时被整体 forbidden——
 * 自定义 command 的 read_file 不走 fs:scope(打开单文件一直正常),唯独文件树
 * (含子目录的 MD 文件)索引失败,且异常被静默吞掉。
 *
 * 修复:chooseWorkspace 在读目录前 invoke('allow_workspace_dir')(Rust 侧
 * allow_directory 递归放行)。本测试锁定该行为:mock 下沉到 plugin-dialog /
 * plugin-fs / invoke 桥,走真实 chooseWorkspace → refreshTree 链路。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const invokeMock = vi.hoisted(() => vi.fn())
const readDirMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => invokeMock(cmd, args),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(async () => 'D:\\ws'),
}))
vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: (path: string) => readDirMock(path),
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
  invokeMock.mockResolvedValue(null)
  readDirMock.mockReset()
  // 根目录:1 个子目录 + 1 个 md(plugin-fs DirEntry 形态)
  readDirMock.mockResolvedValue([
    { name: 'notes', isDirectory: true, isFile: false },
    { name: 'README.md', isDirectory: false, isFile: true },
  ])
})

describe('chooseWorkspace 的 fs scope 运行时授权(bugfix-004)', () => {
  it('选定工作区后先 invoke allow_workspace_dir,再成功索引文件树', async () => {
    const ws = useWorkspaceStore()

    await ws.chooseWorkspace()

    expect(invokeMock).toHaveBeenCalledWith('allow_workspace_dir', { path: 'D:\\ws' })
    expect(readDirMock).toHaveBeenCalledWith('D:\\ws')
    expect(ws.rootPath).toBe('D:\\ws')
    expect(ws.tree.map((n) => n.name)).toEqual(['notes', 'README.md'])
  })

  it('对话框取消(返回 null)→ 不做任何授权与读盘', async () => {
    const { open } = await import('@tauri-apps/plugin-dialog')
    ;(open as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    const ws = useWorkspaceStore()

    await ws.chooseWorkspace()

    expect(invokeMock).not.toHaveBeenCalled()
    expect(readDirMock).not.toHaveBeenCalled()
    expect(ws.rootPath).toBeNull()
  })

  it('授权 invoke 失败 → 错误向上传播(与 readDir forbidden 同待遇,不被静默吞掉)', async () => {
    invokeMock.mockRejectedValue('INTERNAL_ERROR: allow fs scope failed')
    const ws = useWorkspaceStore()

    await expect(ws.chooseWorkspace()).rejects.toBeTruthy()
    expect(readDirMock).not.toHaveBeenCalled()
  })
})
