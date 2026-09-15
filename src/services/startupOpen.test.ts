import { describe, expect, it, vi, beforeEach } from 'vitest'
import { takeStartupOpenPath } from './startupOpen'
import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/services/env'

/**
 * 复现(bugfix-001):软件作为默认打开方式启动时,系统会把文档路径
 * 作为命令行参数传给 exe。Rust 端需要有命令把它交给前端。
 * 本文件锁定 service 层契约:仅桌面环境消费一次性启动路径,Web 恒为 null。
 */

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@/services/env', async () => {
  const actual = await vi.importActual<typeof import('@/services/env')>('@/services/env')
  return { ...actual, isTauri: vi.fn() }
})

const invokeMock = vi.mocked(invoke)
const isTauriMock = vi.mocked(isTauri)

beforeEach(() => {
  invokeMock.mockReset()
  isTauriMock.mockReset()
})

describe('takeStartupOpenPath', () => {
  it('桌面环境:透传 Rust 端返回的启动路径', async () => {
    isTauriMock.mockReturnValue(true)
    invokeMock.mockResolvedValue('D:\\notes\\demo.md')
    await expect(takeStartupOpenPath()).resolves.toBe('D:\\notes\\demo.md')
    expect(invokeMock).toHaveBeenCalledWith('take_startup_open_path')
  })

  it('桌面环境:无启动路径时返回 null', async () => {
    isTauriMock.mockReturnValue(true)
    invokeMock.mockResolvedValue(null)
    await expect(takeStartupOpenPath()).resolves.toBeNull()
  })

  it('纯 Web 环境:不发起 invoke,直接返回 null', async () => {
    isTauriMock.mockReturnValue(false)
    await expect(takeStartupOpenPath()).resolves.toBeNull()
    expect(invokeMock).not.toHaveBeenCalled()
  })
})
