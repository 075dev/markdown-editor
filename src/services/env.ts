/**
 * 环境判定：检测当前是否在 Tauri 桌面壳内运行。
 * - `__TAURI_INTERNALS__` 是 Tauri 2 在 window 上注入的内部对象。
 * - 任何对 Tauri API 的调用都必须先经过这里，否则会在 Web 环境抛错。
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false
  // @ts-expect-error Tauri 在 window 上注入的内部对象
  return typeof window.__TAURI_INTERNALS__ !== 'undefined'
}