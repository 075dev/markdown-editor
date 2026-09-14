import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { saveMarkdownFile, createNewFile, readTextFile } from '@/services/fileService'
import type { QlError } from '@/services/errors'
import { save as saveDialogMock } from '@tauri-apps/plugin-dialog'
import { writeTextFile as fsWriteMock, readTextFile as fsReadMock } from '@tauri-apps/plugin-fs'
import { invoke as invokeMock } from '@tauri-apps/api/core'

/**
 * 保存/新建通道的错误规范化(填充阶段 T1-fill):
 *   - 用户取消(dialog 返回 null / Web AbortError)→ null,不是错误
 *   - 写盘失败 → 抛 QlError;无法分类时按通道升级 FILE_WRITE_FAILED
 *     (自动保存指数退避重试依赖此码判别)
 *   - readTextFile(tauri)失败 → 抛 QlError(骨架行为,回归保护)
 */

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
  open: vi.fn(),
}))
vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(),
  readTextFile: vi.fn(),
}))
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))

function forceTauri(on: boolean) {
  if (on) {
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
  } else {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  }
}

async function expectQlError(promise: Promise<unknown>, code: string, messagePart?: string) {
  try {
    await promise
    expect.unreachable('should have thrown QlError')
  } catch (err) {
    expect((err as QlError).code).toBe(code)
    if (messagePart !== undefined) {
      expect((err as QlError).message).toContain(messagePart)
    }
  }
}

beforeEach(() => {
  forceTauri(true)
  vi.mocked(saveDialogMock).mockReset()
  vi.mocked(fsWriteMock).mockReset()
  vi.mocked(fsReadMock).mockReset()
  vi.mocked(invokeMock).mockReset()
})

afterEach(() => {
  forceTauri(false)
})

describe('saveMarkdownFile(Tauri 通道)错误规范化', () => {
  it('用户取消(save 返回 null)→ 返回 null,不抛错', async () => {
    vi.mocked(saveDialogMock).mockResolvedValue(null)
    await expect(saveMarkdownFile('content')).resolves.toBeNull()
    expect(fsWriteMock).not.toHaveBeenCalled()
  })

  it('带 suggestedPath 时不弹对话框,直接写盘', async () => {
    vi.mocked(fsWriteMock).mockResolvedValue(undefined)
    await expect(saveMarkdownFile('content', '/a/demo.md')).resolves.toEqual({
      path: '/a/demo.md',
    })
    expect(saveDialogMock).not.toHaveBeenCalled()
    expect(fsWriteMock).toHaveBeenCalledWith('/a/demo.md', 'content')
  })

  it('写盘 denied → 抛 QlError FILE_WRITE_FAILED', async () => {
    vi.mocked(fsWriteMock).mockRejectedValue(new Error('Access is denied'))
    await expectQlError(saveMarkdownFile('x', '/a/demo.md'), 'FILE_WRITE_FAILED', 'Access is denied')
  })

  it('裸 syscall 文本(无法分类)→ 按写盘通道升级 FILE_WRITE_FAILED', async () => {
    vi.mocked(fsWriteMock).mockRejectedValue(new Error('os error 5'))
    await expectQlError(saveMarkdownFile('x', '/a/demo.md'), 'FILE_WRITE_FAILED', 'os error 5')
  })

  it('Rust 侧已带 FILE_WRITE_FAILED 前缀 → 码保持,前缀剥离', async () => {
    vi.mocked(fsWriteMock).mockRejectedValue('FILE_WRITE_FAILED: disk full')
    await expectQlError(saveMarkdownFile('x', '/a/demo.md'), 'FILE_WRITE_FAILED', 'disk full')
  })

  it('已分类为 FILE_NOT_FOUND 的写盘错误不被通道改写', async () => {
    vi.mocked(fsWriteMock).mockRejectedValue('FILE_NOT_FOUND: target dir missing')
    await expectQlError(saveMarkdownFile('x', '/a/demo.md'), 'FILE_NOT_FOUND')
  })
})

describe('createNewFile(Tauri 通道)错误规范化', () => {
  it('用户取消 → null,不抛错', async () => {
    vi.mocked(saveDialogMock).mockResolvedValue(null)
    await expect(createNewFile({ suggestedName: 'u.md' })).resolves.toBeNull()
  })

  it('写盘失败 → QlError FILE_WRITE_FAILED', async () => {
    vi.mocked(saveDialogMock).mockResolvedValue('/a/new.md')
    vi.mocked(fsWriteMock).mockRejectedValue(new Error('文件被占用'))
    await expectQlError(createNewFile(), 'FILE_WRITE_FAILED', '文件被占用')
    expect(fsWriteMock).toHaveBeenCalledWith('/a/new.md', '')
  })
})

describe('readTextFile(Tauri 通道)回归保护', () => {
  it('read_file 失败 → 抛 QlError FILE_NOT_FOUND(前缀解析)', async () => {
    vi.mocked(invokeMock).mockRejectedValue('FILE_NOT_FOUND: no such file')
    await expectQlError(readTextFile('/a/gone.md'), 'FILE_NOT_FOUND', 'no such file')
  })

  it('read_file 成功 → 返回内容字符串', async () => {
    vi.mocked(invokeMock).mockResolvedValue('file body')
    await expect(readTextFile('/a/ok.md')).resolves.toBe('file body')
  })
})

describe('saveMarkdownFile(Web 通道)', () => {
  it('用户取消(AbortError)→ null,与 Tauri 取消语义对齐', async () => {
    forceTauri(false)
    const abort = Object.assign(new Error('user aborted'), { name: 'AbortError' })
    const picker = vi.fn().mockRejectedValue(abort)
    Object.defineProperty(window, 'showSaveFilePicker', {
      value: picker,
      configurable: true,
    })
    try {
      await expect(saveMarkdownFile('x')).resolves.toBeNull()
    } finally {
      // @ts-expect-error 测试清理
      delete window.showSaveFilePicker
    }
  })

  it('选择器真异常(非取消)→ 抛 QlError(INTERNAL_ERROR 兜底)', async () => {
    forceTauri(false)
    const picker = vi.fn().mockRejectedValue(new Error('security error'))
    Object.defineProperty(window, 'showSaveFilePicker', {
      value: picker,
      configurable: true,
    })
    try {
      await expectQlError(saveMarkdownFile('x'), 'INTERNAL_ERROR', 'security error')
    } finally {
      // @ts-expect-error 测试清理
      delete window.showSaveFilePicker
    }
  })

  it('Web 写盘失败(createWritable 抛错)→ 通道升级 FILE_WRITE_FAILED', async () => {
    forceTauri(false)
    const handle = {
      name: 'demo.md',
      createWritable: vi.fn().mockRejectedValue(new Error('quota exceeded')),
    }
    const picker = vi.fn().mockResolvedValue(handle)
    Object.defineProperty(window, 'showSaveFilePicker', {
      value: picker,
      configurable: true,
    })
    try {
      await expectQlError(saveMarkdownFile('x'), 'FILE_WRITE_FAILED', 'quota exceeded')
    } finally {
      // @ts-expect-error 测试清理
      delete window.showSaveFilePicker
    }
  })
})
