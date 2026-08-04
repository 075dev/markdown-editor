import { isTauri } from '@/services/env'

export interface DiagramWindowOptions {
  /** PlantUML 已编码的完整 URL（含 https://...svg/...） */
  url: string
  /** 窗口标题（默认 "UML 图"） */
  title?: string
  /** 原始 PlantUML 源码（用于独立窗口显示复制按钮） */
  source?: string
  /** 窗口宽度 */
  width?: number
  /** 窗口高度 */
  height?: number
}

/**
 * 打开 PlantUML 图的独立查看窗口。
 *
 * 三种环境的回退顺序：
 *   1. Tauri 桌面：调后端 open_diagram_window 命令，弹原生 WebviewWindow
 *   2. Web 环境 + 后端未就绪：返回 false（调用方应隐藏按钮或显示提示）
 *
 * 设计：当前实现不做 window.open 回退，因为浏览器标签体验割裂；
 * 调用方应通过 canOpenInWindow() 在 Web 模式下不渲染按钮。
 */

export function canOpenInWindow(): boolean {
  // 仅 Tauri 环境支持
  return isTauri()
}

export async function openDiagramWindow(opts: DiagramWindowOptions): Promise<boolean> {
  if (!isTauri()) {
    console.warn('[diagramWindow] openDiagramWindow called outside Tauri; ignoring')
    return false
  }
  // 动态 import 以避免 Web 打包体积中携带 Tauri API
  const { invoke } = await import('@tauri-apps/api/core')
  try {
    await invoke('open_diagram_window', {
      url: opts.url,
      title: opts.title ?? 'UML 图',
      source: opts.source ?? '',
      width: opts.width ?? 1024,
      height: opts.height ?? 768,
    })
    return true
  } catch (err) {
    console.error('[diagramWindow] failed to open window:', err)
    return false
  }
}