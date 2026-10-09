import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { openExternal } from '@/services/externalLinks'
import type { QlError } from '@/services/errors'
import { invoke as invokeMock } from '@tauri-apps/api/core'

/**
 * 外部链接打开通道(add-002 T1,契约 POST /ipc/open-external):
 *   - Tauri 分支:invoke('open_external', { target }),错误经 normalizeError 抛 QlError
 *   - Web 降级分支(C2):window.open(target, '_blank', 'noopener');返回 null → 抛错
 * mock 惯例与 fileService.save-errors.test.ts 保持一致(vi.mock + forceTauri)。
 */

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
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
  vi.mocked(invokeMock).mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
  forceTauri(false)
})

describe('openExternal(Tauri 通道)', () => {
  it('invoke open_external 并透传 target,成功即 resolve', async () => {
    vi.mocked(invokeMock).mockResolvedValue(null)
    await expect(openExternal('https://example.com/doc')).resolves.toBeUndefined()
    expect(invokeMock).toHaveBeenCalledWith('open_external', {
      target: 'https://example.com/doc',
    })
  })

  it('白名单外协议(Rust UNSUPPORTED_PROTOCOL 前缀)→ 抛 QlError,携带 code', async () => {
    vi.mocked(invokeMock).mockRejectedValue(
      'UNSUPPORTED_PROTOCOL: only http/https/mailto protocols are allowed: file:///etc/passwd',
    )
    // errors.ts 分类器已收录 UNSUPPORTED_PROTOCOL(add-002 T3),前缀直接命中
    await expectQlError(
      openExternal('file:///etc/passwd'),
      'UNSUPPORTED_PROTOCOL',
      'only http/https/mailto protocols are allowed',
    )
  })

  it('系统打开失败(Rust OPEN_EXTERNAL_FAILED 前缀)→ 抛 QlError,携带 code', async () => {
    vi.mocked(invokeMock).mockRejectedValue(
      'OPEN_EXTERNAL_FAILED: failed to open external target: no association',
    )
    await expectQlError(
      openExternal('https://example.com'),
      'OPEN_EXTERNAL_FAILED',
      'no association',
    )
  })
})

describe('openExternal(Web 降级通道,宪法 C2)', () => {
  it('window.open 以 _blank + noopener 打开,成功即 resolve', async () => {
    forceTauri(false)
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(window)
    await expect(openExternal('https://example.com/doc')).resolves.toBeUndefined()
    expect(openSpy).toHaveBeenCalledWith('https://example.com/doc', '_blank', 'noopener')
  })

  it('弹窗被拦截(window.open 返回 null)→ 抛 QlError INTERNAL_ERROR', async () => {
    forceTauri(false)
    const openSpy = vi.spyOn(window, 'open')
    openSpy.mockImplementation(() => null)
    const p = openExternal('https://example.com/doc')
    await expectQlError(p, 'INTERNAL_ERROR', 'popup blocked')
    expect(openSpy).toHaveBeenCalledWith('https://example.com/doc', '_blank', 'noopener')
  })
})
