/**
 * 文件服务抽象：
 * - 在 Tauri 桌面环境下走 `@tauri-apps/plugin-fs` + `@tauri-apps/plugin-dialog`
 * - 在纯 Web 环境下使用 File System Access API（Chrome/Edge）或回退到 <input type="file">
 *
 * 这样上层（Pinia store）调用同一套接口，无须感知运行环境。
 */

import { isTauri } from '@/services/env'
import { normalizeError, withFallbackCode } from '@/services/errors'

export interface OpenFileResult {
  path: string
  content: string
}

export interface SaveFileResult {
  path: string
}

/** 新建文件选项 */
export interface NewFileOptions {
  /** 建议的初始内容（默认空） */
  initialContent?: string
  /** 建议文件名（默认 untitled.md） */
  suggestedName?: string
}

export interface DirEntry {
  name: string
  path: string
  isDir: boolean
}

/* ---------- Tauri 实现 ---------- */
async function tauriOpenFile(): Promise<OpenFileResult | null> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const { readTextFile } = await import('@tauri-apps/plugin-fs')
  const selected = await open({
    multiple: false,
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdx', 'txt'] }],
  })
  if (!selected || typeof selected !== 'string') return null
  const content = await readTextFile(selected)
  return { path: selected, content }
}

async function tauriSaveFile(
  content: string,
  suggestedPath?: string,
): Promise<SaveFileResult | null> {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const { writeTextFile } = await import('@tauri-apps/plugin-fs')
  // 用户取消(save 返回 null)= 契约正常路径;异常统一规范化为 QlError。
  let target: string | null
  if (suggestedPath) {
    target = suggestedPath
  } else {
    try {
      target = await save({
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
      })
    } catch (err) {
      // 对话框异常无法细分类别,保留原始 message(INTERNAL_ERROR)
      throw normalizeError(err)
    }
  }
  if (!target) return null
  try {
    await writeTextFile(target, content)
  } catch (err) {
    // 写盘通道:无法分类的兜底升级为 FILE_WRITE_FAILED,
    // 自动保存的指数退避重试依赖此码判别(填充阶段 T2)
    throw withFallbackCode(normalizeError(err), 'FILE_WRITE_FAILED')
  }
  return { path: target }
}

async function tauriNewFile(opts: NewFileOptions = {}): Promise<SaveFileResult | null> {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const { writeTextFile } = await import('@tauri-apps/plugin-fs')
  let target: string | null
  try {
    target = await save({
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
      defaultPath: opts.suggestedName ?? 'untitled.md',
    })
  } catch (err) {
    // 对话框异常:保留原始 message
    throw normalizeError(err)
  }
  if (!target) return null
  try {
    await writeTextFile(target, opts.initialContent ?? '')
  } catch (err) {
    // 写盘通道:兜底升级 FILE_WRITE_FAILED(与 tauriSaveFile 同策略)
    throw withFallbackCode(normalizeError(err), 'FILE_WRITE_FAILED')
  }
  return { path: target }
}

async function tauriPickDirectory(): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const result = await open({ directory: true, multiple: false })
  if (!result || typeof result !== 'string') return null
  return result
}

async function tauriListDir(path: string): Promise<DirEntry[]> {
  const { readDir } = await import('@tauri-apps/plugin-fs')
  const entries = await readDir(path)
  return entries.map((entry) => ({
    name: entry.name ?? '',
    path: `${path}/${entry.name ?? ''}`,
    isDir: !!entry.isDirectory,
  }))
}

/* ---------- Web 实现（File System Access API） ---------- */
type WebFileHandle = {
  name: string
  // Web File System Access API
}

async function webOpenFile(): Promise<OpenFileResult | null> {
  // @ts-expect-error showOpenFilePicker 尚未纳入 TS 标准库
  if (typeof window.showOpenFilePicker === 'function') {
    // @ts-expect-error 同上
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'Markdown',
          accept: {
            'text/markdown': ['.md', '.markdown', '.mdx', '.txt'],
          },
        },
      ],
    })
    const file = await handle.getFile()
    const content = await file.text()
    return { path: file.name, content }
  }
  return null
}

/** File System Access API 里用户取消选择时抛的 DOMException(name=AbortError) */
function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: unknown }).name === 'AbortError'
  )
}

async function webSaveFile(content: string, suggestedPath?: string): Promise<SaveFileResult | null> {
  // @ts-expect-error showSaveFilePicker 尚未纳入 TS 标准库
  if (typeof window.showSaveFilePicker === 'function') {
    let handle: WebFileHandle
    try {
      handle = suggestedPath
        ? // @ts-expect-error 同上
          await window.showSaveFilePicker({ suggestedName: suggestedPath })
        : // @ts-expect-error 同上
          await window.showSaveFilePicker({
            types: [
              {
                description: 'Markdown',
                accept: { 'text/markdown': ['.md', '.markdown'] },
              },
            ],
          })
    } catch (err) {
      // 用户取消 = 契约的 null 返回(与 Tauri save() 返回 null 对齐)
      if (isAbortError(err)) return null
      throw normalizeError(err)
    }
    try {
      // @ts-expect-error 同上
      const writable = await handle.createWritable()
      await writable.write(content)
      await writable.close()
    } catch (err) {
      // Web 写盘通道:与 Tauri 通道同策略,兜底升级 FILE_WRITE_FAILED
      throw withFallbackCode(normalizeError(err), 'FILE_WRITE_FAILED')
    }
    return { path: handle.name }
  }
  // 回退：浏览器下载
  try {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = suggestedPath ?? 'untitled.md'
    a.click()
    URL.revokeObjectURL(url)
    return { path: a.download }
  } catch (err) {
    throw withFallbackCode(normalizeError(err), 'FILE_WRITE_FAILED')
  }
}

async function webNewFile(opts: NewFileOptions = {}): Promise<SaveFileResult | null> {
  // Web 模式下没有真实文件系统，新建即触发下载
  return webSaveFile(opts.initialContent ?? '', opts.suggestedName ?? 'untitled.md')
}

/* ---------- 公开接口 ---------- */

export async function openMarkdownFile(): Promise<OpenFileResult | null> {
  return isTauri() ? tauriOpenFile() : webOpenFile()
}

export async function saveMarkdownFile(
  content: string,
  suggestedPath?: string,
): Promise<SaveFileResult | null> {
  return isTauri() ? tauriSaveFile(content, suggestedPath) : webSaveFile(content, suggestedPath)
}

export async function createNewFile(opts: NewFileOptions = {}): Promise<SaveFileResult | null> {
  return isTauri() ? tauriNewFile(opts) : webNewFile(opts)
}

export async function pickWorkspaceDirectory(): Promise<string | null> {
  return isTauri() ? tauriPickDirectory() : null
}

export async function listDirectory(path: string): Promise<DirEntry[]> {
  return isTauri() ? tauriListDir(path) : []
}

/* ---------- 文件监听（外部修改自动重载） ---------- */

import type { UnlistenFn } from '@tauri-apps/api/event'

/**
 * 监听一个文件的外部修改事件。
 * Tauri 模式下通过后端 notify crate 监听文件系统，
 * 收到事件后通过 'file-external-change' 事件推给前端。
 *
 * Web 模式下不存在跨进程文件监听，降级为不可用。
 */
export async function watchFileExternal(path: string): Promise<UnlistenFn | null> {
  if (!isTauri()) return null
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')
    await invoke('watch_file', { path })
    const unlisten = await listen<{ path: string; kind?: 'modified' | 'removed' }>(
      'file-external-change',
      (event) => {
        if (event.payload?.path === path) {
          window.dispatchEvent(
            new CustomEvent('mde:file-external-change', {
              detail: { path, kind: event.payload.kind ?? 'modified' },
            }),
          )
        }
      },
    )
    return unlisten
  } catch (err) {
    // 骨架期契约:watch 建立失败不再吞错,抛规范化 QlError(含 code)
    throw normalizeError(err)
  }
}

export async function unwatchFileExternal(): Promise<void> {
  if (!isTauri()) return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('unwatch_file')
  } catch {
    // unwatch 失败无用户可行动作(最多残留一个后端 watcher),
    // 静默忽略即可;按宪法 C3 不落 console。
  }
}

/** 重新读取文件内容（用于外部修改事件触发后的实际重载） */
export async function readTextFile(path: string): Promise<string | null> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const content = await invoke<string>('read_file', { path })
      return content
    } catch (err) {
      // 骨架期契约:读失败不再吞错,抛规范化 QlError(含 code)
      throw normalizeError(err)
    }
  }
  // Web 模式：File System Access API 可以拿到已授权文件的 handle
  try {
    // @ts-expect-error getFileByPath 不是标准 API（仅 Chromium 实验）
    if (typeof window.getFileByPath === 'function') {
      // @ts-expect-error
      const file = await window.getFileByPath(path)
      return await file.text()
    }
  } catch {
    /* ignore */
  }
  return null
}