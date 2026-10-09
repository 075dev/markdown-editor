/**
 * 剪贴板与选中区域的统一入口。
 *
 * 不依赖任何第三方库：
 *   - navigator.clipboard 是浏览器/Tauri Webview 都有的标准 API。
 *   - 写失败时降级到 execCommand('copy'/'cut')。
 *
 * 注意：clipboard API 必须在 secure context 下使用；Tauri WebView 算 secure
 * context，浏览器 http://localhost 也算。
 */

export interface WriteResult {
  ok: boolean
  error?: string
}

export async function writeClipboard(text: string): Promise<WriteResult> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return { ok: true }
    }
  } catch (err) {
    // 权限失败 / 不是 secure context ⇒ 走 execCommand 兜底
  }
  // 兜底：临时 textarea + execCommand
  const ok = execCommandFallback('copy', text)
  return ok ? { ok: true } : { ok: false, error: 'clipboard unavailable' }
}

export async function readClipboard(): Promise<string> {
  try {
    if (navigator.clipboard?.readText) {
      return await navigator.clipboard.readText()
    }
  } catch (err) {
    // 用户拒绝授权或不支持
  }
  return ''
}

/**
 * 当前页面原生选中的文本。document.getSelection 把所有选区合并成一个字符串。
 */
export function readSelection(): string {
  const sel = typeof document !== 'undefined' ? document.getSelection() : null
  return sel ? sel.toString() : ''
}

/**
 * 检查 event 触发点是否在可编辑文本里。
 * 命中：<input type=text|search|url|...>、<textarea>、contenteditable。
 * CodeMirror 6 用 contenteditable，所以也命中。
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type
    const editable = ['text', 'search', 'url', 'email', 'tel', 'password', 'number']
    return editable.includes(type) || type === ''
  }
  if (tag === 'TEXTAREA') return true

  // contenteditable：先看自身，再向上找最近一个设置了 contentEditable 的祖先
  if (target.isContentEditable) return true
  // 部分 jsdom 实现与 iOS 上 attribute 可能未同步成 idl 状态，向上找一次：
  let cur: HTMLElement | null = target
  while (cur && cur !== document.body) {
    if (cur.getAttribute && cur.getAttribute('contenteditable') !== null) return true
    if ((cur as HTMLElement).classList?.contains('cm-content')) return true
    cur = cur.parentElement
  }
  return false
}

/* ---------- 内部 ---------- */

export function execCommandFallback(cmd: 'copy' | 'cut', text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand(cmd)
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
