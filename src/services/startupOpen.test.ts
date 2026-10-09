import { describe, expect, it, vi, beforeEach } from 'vitest'
import { takeStartupOpenPath, onStartupOpenFile } from './startupOpen'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { isTauri } from '@/services/env'

/**
 * 复现(bugfix-001):软件作为默认打开方式启动时,系统会把文档路径
 * 作为命令行参数传给 exe。Rust 端需要有命令把它交给前端。
 * 本文件锁定 service 层契约:仅桌面环境消费一次性启动路径,Web 恒为 null。
 *
 * bugfix-002 追加:暖启动(应用已运行再双击文件)时,Rust 端经
 * single-instance 插件转发 argv 并 emit "startup-open-file",
 * 前端经 onStartupOpenFile 订阅。
 */

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }))
vi.mock('@/services/env', async () => {
  const actual = await vi.importActual<typeof import('@/services/env')>('@/services/env')
  return { ...actual, isTauri: vi.fn() }
})

const invokeMock = vi.mocked(invoke)
const listenMock = vi.mocked(listen)
const isTauriMock = vi.mocked(isTauri)

beforeEach(() => {
  invokeMock.mockReset()
  listenMock.mockReset()
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

describe('onStartupOpenFile(bugfix-002 暖启动转发)', () => {
  it('桌面环境:注册 startup-open-file 监听,事件触发时以路径调用 handler', async () => {
    isTauriMock.mockReturnValue(true)
    let captured: ((e: { payload: { path: string } }) => void) | undefined
    listenMock.mockImplementation(async (_event, cb) => {
      captured = cb as (e: { payload: { path: string } }) => void
      return () => {}
    })
    const handler = vi.fn()
    await onStartupOpenFile(handler)
    expect(listenMock).toHaveBeenCalledWith('startup-open-file', expect.any(Function))
    captured?.({ payload: { path: 'D:\\warm.md' } })
    expect(handler).toHaveBeenCalledWith('D:\\warm.md')
  })

  it('payload 缺 path 时不调用 handler', async () => {
    isTauriMock.mockReturnValue(true)
    let captured: ((e: { payload: { path?: string } }) => void) | undefined
    listenMock.mockImplementation(async (_event, cb) => {
      captured = cb as (e: { payload: { path?: string } }) => void
      return () => {}
    })
    const handler = vi.fn()
    await onStartupOpenFile(handler)
    captured?.({ payload: {} })
    expect(handler).not.toHaveBeenCalled()
  })

  it('桌面环境:返回 unlisten 并透传', async () => {
    isTauriMock.mockReturnValue(true)
    const unlisten = vi.fn()
    listenMock.mockResolvedValue(unlisten)
    const got = await onStartupOpenFile(vi.fn())
    got()
    expect(unlisten).toHaveBeenCalled()
  })

  it('纯 Web 环境:不注册监听,返回 no-op', async () => {
    isTauriMock.mockReturnValue(false)
    const got = await onStartupOpenFile(vi.fn())
    expect(listenMock).not.toHaveBeenCalled()
    expect(() => got()).not.toThrow()
  })
})
