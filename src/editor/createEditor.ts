import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import {
  bracketMatching,
  defaultHighlightStyle,
  syntaxHighlighting,
  indentOnInput,
  foldGutter,
  foldKeymap,
} from '@codemirror/language'
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { markdownExtensions } from './markdownLanguage'
import { selectionLineFill, selectionLineFillTheme } from './selectionLineFill'

/**
 * 全局 CM view 注册表：让 main.ts 的 contextmenu 调度器能找到
 * "right-clicked 这一行所在的 EditorView"，从而实现真正的剪贴/粘贴。
 *
 * key 选择：CodeMirror 的 contentDOM 是 .cm-content（inner div），
 * 我们在构造时把 view.contentDOM → view 自身登记到这张表。
 * 销毁（destroy）时移除。
 *
 * 写操作根：执行剪切时我们要 view.dispatch({changes: ...})，
 * 该事务必须在 view 自己的 state 上发，避免与其它 view 错位。
 */
const viewRegistry = new WeakMap<HTMLElement, EditorView>()

export function getEditorViewFromDom(node: EventTarget | null): EditorView | null {
  if (!(node instanceof Node)) return null
  // 找到最近的 .cm-content
  let cur: Node | null = node
  while (cur && cur !== document.body) {
    if (cur instanceof HTMLElement && cur.classList?.contains('cm-content')) {
      const view = viewRegistry.get(cur)
      if (view) return view
    }
    cur = cur.parentNode
  }
  return null
}

export interface CreateEditorOptions {
  initialDoc?: string
  onChange?: (value: string) => void
  onScroll?: (scrollTop: number, scrollHeight: number) => void
  /** 初始 mono 字体栈（如 'Cascadia Code, ui-monospace, ...'） */
  monoFont?: string
  /** 初始字号（px） */
  fontSize?: number
}

export interface CreatedEditor {
  view: EditorView
  setValue: (value: string) => void
  getValue: () => string
  setDark: (dark: boolean) => void
  /** 更新 CodeMirror 编辑器的字体与字号（触发主题重新应用） */
  applyTheme: (opts: { monoFont?: string; fontSize?: number }) => void
  scrollToLine: (line: number) => void
  /** 编辑区的真实滚动容器（CodeMirror view.scrollDOM）。 */
  getScrollElement: () => HTMLElement
  destroy: () => void
}

/**
 * 创建 CodeMirror 6 编辑器实例，并返回一组桥接到 Vue 的方法。
 * 该工厂被设计成可独立测试，所以不直接依赖 Vue 的 ref / lifecycle。
 */
export function createMarkdownEditor(
  parent: HTMLElement,
  options: CreateEditorOptions = {},
): CreatedEditor {
  const fontCompartment = new Compartment()
  const sizeCompartment = new Compartment()
  let lastDoc = options.initialDoc ?? ''

  const initialFont = options.monoFont ?? 'var(--font-mono)'
  const initialSize = options.fontSize ?? 14

  const state = EditorState.create({
    doc: lastDoc,
    extensions: [
      lineNumbers(),
      foldGutter(),
      highlightActiveLine(),
      drawSelection(),
      selectionLineFill,
      selectionLineFillTheme,
      highlightSelectionMatches(),
      history(),
      bracketMatching(),
      indentOnInput(),
      closeBrackets(),
      autocompletion(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      ...markdownExtensions(),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        indentWithTab,
      ]),
      // 字体 + 字号用 Compartment 包装，便于运行时热替换。
      // 这里直接写字面值而不是 var() —— 因为 CodeMirror 6 的 style module
      // 把规则塞进一个独立 styleSheet，可能不在 :root 作用域里，
      // 导致 var() 在某些 WebView 下解析失败。
      fontCompartment.of(
        EditorView.theme({
          '&': { fontFamily: initialFont },
          '.cm-scroller': { fontFamily: initialFont },
        }),
      ),
      sizeCompartment.of(
        EditorView.theme({
          '&': { fontSize: `${initialSize}px` },
          '.cm-scroller': { fontSize: `${initialSize}px`, lineHeight: '1.65' },
        }),
      ),
      EditorView.theme({
        '&': {
          height: '100%',
          backgroundColor: 'var(--bg)',
          color: 'var(--text-1)',
        },
        '.cm-content': { padding: '16px 12px' },
        '.cm-gutters': {
          backgroundColor: 'var(--bg-sidebar)',
          color: 'var(--text-2)',
          border: 'none',
        },
        '.cm-activeLine': { backgroundColor: 'var(--bg-elev)' },
        '.cm-activeLineGutter': { backgroundColor: 'var(--bg-elev)', color: 'var(--text-1)' },
        '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
        '.cm-selectionBackground, ::selection': { backgroundColor: 'var(--selection)' },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          lastDoc = update.state.doc.toString()
          options.onChange?.(lastDoc)
        }
      }),
      EditorView.domEventHandlers({
        scroll(_event, view) {
          const scrollDOM = view.scrollDOM
          options.onScroll?.(scrollDOM.scrollTop, scrollDOM.scrollHeight)
        },
      }),
    ],
  })

  const view = new EditorView({ state, parent })

  // 注册到全局 registry，便于 main.ts 的 contextmenu 调度找到当前 view
  viewRegistry.set(view.contentDOM, view)
  const originalDestroy = view.destroy.bind(view)
  view.destroy = () => {
    viewRegistry.delete(view.contentDOM)
    originalDestroy()
  }

  return {
    view,
    /**
     * 编辑区的可滚动容器。CodeMirror 自己管理这块 DOM（view.scrollDOM），
     * 让上层（同步滚动 hook）能直接挂监听。
     */
    getScrollElement: () => view.scrollDOM,
    getValue: () => lastDoc,
    setValue: (value) => {
      lastDoc = value
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      })
    },
    setDark: (dark) => {
      view.dispatch({
        effects: fontCompartment.reconfigure([]),
      })
      void dark // 未来扩展：注入暗色主题 compartment
    },
    applyTheme: ({ monoFont, fontSize }) => {
      const effects: { compartment: Compartment; value: unknown }[] = []
      if (monoFont) {
        effects.push({
          compartment: fontCompartment,
          value: EditorView.theme({
            '&': { fontFamily: monoFont },
            '.cm-scroller': { fontFamily: monoFont },
          }),
        })
      }
      if (fontSize) {
        effects.push({
          compartment: sizeCompartment,
          value: EditorView.theme({
            '&': { fontSize: `${fontSize}px` },
            '.cm-scroller': { fontSize: `${fontSize}px`, lineHeight: '1.65' },
          }),
        })
      }
      if (effects.length > 0) {
        view.dispatch({
          effects: effects.map((e) => e.compartment.reconfigure(e.value as Parameters<typeof e.compartment.reconfigure>[0])),
        })
      }
    },
    scrollToLine: (line) => {
      const block = view.lineBlockAt(view.state.doc.line(Math.max(1, line)).from)
      view.scrollDOM.scrollTo({ top: block.top - 16, behavior: 'smooth' })
    },
    destroy: () => view.destroy(),
  }
}