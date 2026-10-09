import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import './styles/global.css'

import { isEditableTarget, readSelection, writeClipboard } from '@/services/selection'
import { getEditorViewFromDom } from '@/editor/createEditor'
import { copyFromView, cutFromView, pasteIntoView } from '@/services/editorClipboard'
import { useSyntaxCheatsheet } from '@/composables/useSyntaxCheatsheet'

// 语法速查浮层(add-006):编辑器右键菜单的入口之一
const cheatsheet = useSyntaxCheatsheet()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

/**
 * 自定义右键菜单调度器。
 *
 * 规则：
 *   - 右键命中 CodeMirror 编辑器 → 走 CM 自己的 copy/cut/paste（view.dispatch）
 *     走 native 选中范围，disable 按 sel.empty 决定。
 *   - 右键命中普通 input/textarea → 用通用 readSelection + writeClipboard。
 *   - 其他区域有选中文字 → 只弹「复制」。
 *   - 完全空白 → 不弹。
 */
window.addEventListener('contextmenu', async (e: MouseEvent) => {
  // 1) 始终吞掉原生菜单
  e.preventDefault()

  // 2) 找菜单调度入口
  const dispatcher = (window as unknown as {
    __ctxMenu?: (
      x: number,
      y: number,
      items: { key: string; label: string; disabled?: boolean; onSelect: () => void }[],
    ) => void
  }).__ctxMenu
  if (!dispatcher) return

  const editorView = getEditorViewFromDom(e.target)
  // 是否在 CodeMirror 的 DOM 里：通过上一步是否拿到 view 决定。
  // （input / textarea 也走 isEditableTarget）
  const cmSelection = editorView?.state.selection.main
  const cmHasSelection = !!cmSelection && !cmSelection.empty

  const inCm = !!editorView
  const inInput = !inCm && isEditableTarget(e.target)
  const selected = readSelection()

  if (inCm && editorView) {
    dispatcher(e.clientX, e.clientY, [
      {
        key: 'copy',
        label: '复制',
        disabled: !cmHasSelection,
        onSelect: () => {
          void copyFromView(editorView)
        },
      },
      {
        key: 'cut',
        label: '剪切',
        disabled: !cmHasSelection,
        onSelect: () => {
          void cutFromView(editorView)
        },
      },
      {
        key: 'paste',
        label: '粘贴',
        onSelect: () => {
          void pasteIntoView(editorView)
        },
      },
      {
        key: 'syntax-cheatsheet',
        label: '语法速查 (F1)',
        onSelect: () => {
          cheatsheet.openSheet()
        },
      },
    ])
    return
  }

  if (inInput) {
    dispatcher(e.clientX, e.clientY, [
      {
        key: 'copy',
        label: '复制',
        disabled: selected.length === 0,
        onSelect: () => {
          if (selected) void writeClipboard(selected)
        },
      },
      {
        key: 'cut',
        label: '剪切',
        disabled: selected.length === 0,
        onSelect: () => {
          if (selected) void writeClipboard(selected)
        },
      },
      {
        key: 'paste',
        label: '粘贴',
        onSelect: () => {
          // input/textarea 的粘贴交给浏览器原生处理（input.execCommand('insertText') 仍可用）
          // 这里简单起见不做额外实现：浏览器触发。
        },
      },
    ])
    return
  }

  // 非编辑区：只弹"复制"，且必须有选中
  if (selected) {
    dispatcher(e.clientX, e.clientY, [
      {
        key: 'copy',
        label: '复制',
        onSelect: () => {
          void writeClipboard(selected)
        },
      },
    ])
  }
})
