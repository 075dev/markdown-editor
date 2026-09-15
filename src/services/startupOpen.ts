import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { isTauri } from '@/services/env'

/**
 * 取走系统"打开方式"启动时传入的文档路径(bugfix-001)。
 *
 * - 仅桌面环境有效:Rust 端在启动时解析 argv 并暂存,
 *   前端挂载后经此命令一次性取走(take 语义,取走即清空)。
 * - 纯 Web 环境恒为 null(浏览器没有"打开方式"概念)。
 */
export async function takeStartupOpenPath(): Promise<string | null> {
  if (!isTauri()) return null
  return await invoke<string | null>('take_startup_open_path')
}

/**
 * 订阅暖启动文档打开事件(bugfix-002)。
 *
 * 应用已运行时再以"打开方式"双击文档,第二实例的 argv 经
 * single-instance 插件转发给首实例,Rust 端 emit "startup-open-file",
 * 这里把它转成回调。返回 unlisten;纯 Web 环境返回 no-op。
 */
export async function onStartupOpenFile(
  handler: (path: string) => void,
): Promise<() => void> {
  if (!isTauri()) return () => {}
  const unlisten: UnlistenFn = await listen<{ path: string }>('startup-open-file', (e) => {
    const p = e.payload?.path
    if (p) handler(p)
  })
  return unlisten
}
