/**
 * diagramWindow 服务：openDiagramWindow 应当：
 *   - jsdom / 非 Tauri 环境下返回 false（已有用例）
 *   - 在 mock Tauri 时把 windowKey 默认设为 url（去重效果）
 *   - 显式传 windowKey 时按调用方传入
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { canOpenInWindow, openDiagramWindow } from '@/services/diagramWindow'

// 让 isTauri() 返回 true —— 用 __TAURI_INTERNALS__ 作为环境判定。
;(globalThis as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}

const invokeMock = vi.fn(async (_cmd: string, _args?: unknown) => undefined)
vi.mock('@tauri-apps/api/core', async () => {
  const actual = await vi.importActual<typeof import('@tauri-apps/api/core')>(
    '@tauri-apps/api/core',
  )
  return {
    ...actual,
    invoke: (cmd: string, args?: unknown) => invokeMock(cmd, args),
  }
})

beforeEach(() => {
  invokeMock.mockClear()
  invokeMock.mockResolvedValue(undefined)
})

describe('diagramWindow.openDiagramWindow', () => {
  it('在 Tauri 环境下调用 invoke，windowKey 默认为 url', async () => {
    const ok = await openDiagramWindow({
      url: 'https://example.com/u.svg',
      title: 't',
      source: 's',
    })
    expect(ok).toBe(true)
    expect(invokeMock).toHaveBeenCalledTimes(1)
    const args = invokeMock.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(args[0]).toBe('open_diagram_window')
    expect(args[1].url).toBe('https://example.com/u.svg')
    expect(args[1].windowKey).toBe('https://example.com/u.svg')
  })

  it('显式传 windowKey 时透传（前端自定义去重 key 用）', async () => {
    await openDiagramWindow({
      url: 'https://example.com/u.svg',
      windowKey: 'docs/intro.md#uml-1',
    })
    const args = invokeMock.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(args[1].windowKey).toBe('docs/intro.md#uml-1')
  })

  it('缺省 width/height 透传默认值 1024 / 768', async () => {
    await openDiagramWindow({ url: 'x' })
    const args = invokeMock.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(args[1].width).toBe(1024)
    expect(args[1].height).toBe(768)
  })

  it('invoke 抛错时返回 false', async () => {
    invokeMock.mockRejectedValueOnce(new Error('boom'))
    const ok = await openDiagramWindow({ url: 'x' })
    expect(ok).toBe(false)
  })
})

describe('canOpenInWindow', () => {
  it('当 __TAURI_INTERNALS__ 存在时返回 true', () => {
    expect(canOpenInWindow()).toBe(true)
  })
})
