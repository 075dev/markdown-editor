/**
 * 外部链接打开服务(add-002 T1,契约 POST /ipc/open-external → Rust command open_external)。
 *
 * 语义(宪法 C2:有 web 降级分支即合规):
 *   - Tauri 桌面:动态 import invoke 调 `open_external`({ target });
 *     Rust 侧协议白名单(http/https/mailto,大小写不敏感)不过 →
 *     Err("UNSUPPORTED_PROTOCOL: ..."),系统默认程序调用失败 →
 *     Err("OPEN_EXTERNAL_FAILED: ...")。
 *   - Web:降级 window.open(target, '_blank', 'noopener');
 *     返回 null(弹窗被拦截)视为失败,经 normalizeError 抛出。
 *
 * 错误统一经 normalizeError 规范化为 QlError 后抛出(宪法 C4:
 * Rust "CODE: message" 前缀格式)。errors.ts 分类器已收录
 * UNSUPPORTED_PROTOCOL / OPEN_EXTERNAL_FAILED 两个新码(add-002 T3),
 * Rust 前缀直接命中,不再兜底 INTERNAL_ERROR。
 *
 * 宪法 C1:@tauri-apps/* 的 import 仅出现在 src/services/ 下(本文件合规)。
 */
import { isTauri } from './env'
import { normalizeError } from './errors'

export async function openExternal(target: string): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    try {
      await invoke('open_external', { target })
    } catch (err) {
      throw normalizeError(err)
    }
    return
  }
  // Web 降级分支(C2):noopener 隔离 opener,防反 tab 劫持
  const win = window.open(target, '_blank', 'noopener')
  if (win === null) {
    throw normalizeError('popup blocked')
  }
}
