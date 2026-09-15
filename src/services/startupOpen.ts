import { invoke } from '@tauri-apps/api/core'
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
