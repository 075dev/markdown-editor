/**
 * 编辑器剪贴板 / 文本操作。
 *
 * 缘由：CodeMirror 6 自己接管了 input 事件，不会响应 document.execCommand('cut') /
 * document.execCommand('insertText')。如果用这些 API，菜单里的剪切 / 粘贴在 CM
 * 编辑器内是 no-op。
 *
 * 因此：拿到当前 EditorView 后，所有"剪切 / 粘贴"动作都通过 view.dispatch
 * 走自己 state 的事务。
 */

import type { EditorView } from '@codemirror/view'
import { writeClipboard, readClipboard } from './selection'

/**
 * 在给定 view 上执行复制：把当前主选区文本写进系统剪贴板。
 * 不会修改文档。
 */
export async function copyFromView(view: EditorView): Promise<boolean> {
  const sel = view.state.selection.main
  if (sel.empty) return false
  const text = view.state.sliceDoc(sel.from, sel.to)
  if (!text) return false
  const res = await writeClipboard(text)
  return res.ok
}

/**
 * 在给定 view 上执行剪切：
 * 1. 复制选中文本到剪贴板
 * 2. 删除选中文档区间（提交事务，selection 收到起点）
 */
export async function cutFromView(view: EditorView): Promise<boolean> {
  const sel = view.state.selection.main
  if (sel.empty) return false
  const text = view.state.sliceDoc(sel.from, sel.to)
  const res = await writeClipboard(text)
  if (!res.ok) return false
  view.dispatch({
    changes: { from: sel.from, to: sel.to },
    selection: { anchor: sel.from },
    scrollIntoView: true,
  })
  return true
}

/**
 * 在给定 view 上执行粘贴：从剪贴板读文本，insert 到当前位置。
 *
 * CM 把"在当前选区插入文本"建模为：changes.replace(from, to, text)。
 * 选区为空时其实就是 from===to 的插入点。
 */
export async function pasteIntoView(view: EditorView): Promise<boolean> {
  const sel = view.state.selection.main
  const text = await readClipboard()
  if (!text) return false
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: text },
    selection: { anchor: sel.from + text.length },
    scrollIntoView: true,
  })
  return true
}
