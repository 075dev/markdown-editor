/**
 * 文件服务抽象：
 * - 在 Tauri 桌面环境下走 `@tauri-apps/plugin-fs` + `@tauri-apps/plugin-dialog`
 * - 在纯 Web 环境下使用 File System Access API（Chrome/Edge）或回退到 <input type="file">
 *
 * 这样上层（Pinia store）调用同一套接口，无须感知运行环境。
 */

import { isTauri } from '@/services/env'
import { normalizeError } from '@/services/errors'

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
  const target = suggestedPath ?? (await save({
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  }))
  if (!target) return null
  await writeTextFile(target, content)
  return { path: target }
}

async function tauriNewFile(opts: NewFileOptions = {}): Promise<SaveFileResult | null> {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const { writeTextFile } = await import('@tauri-apps/plugin-fs')
  const target = await save({
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    defaultPath: opts.suggestedName ?? 'untitled.md',
  })
  if (!target) return null
  await writeTextFile(target, opts.initialContent ?? '')
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

async function webSaveFile(content: string, suggestedPath?: string): Promise<SaveFileResult | null> {
  // @ts-expect-error showSaveFilePicker 尚未纳入 TS 标准库
  if (typeof window.showSaveFilePicker === 'function') {
    // @ts-expect-file-suggestion
    const handle: WebFileHandle | undefined = suggestedPath
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
    if (!handle) return null
    // @ts-expect-error 同上
    const writable = await handle.createWritable()
    await writable.write(content)
    await writable.close()
    return { path: handle.name }
  }
  // 回退：浏览器下载
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedPath ?? 'untitled.md'
  a.click()
  URL.revokeObjectURL(url)
  return { path: a.download }
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
  } catch (err) {
    console.warn('[fileService] unwatchFileExternal failed:', err)
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