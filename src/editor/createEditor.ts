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
          color: 'var(--fg)',
        },
        '.cm-content': { padding: '16px 12px' },
        '.cm-gutters': {
          backgroundColor: 'var(--bg-sidebar)',
          color: 'var(--fg-muted)',
          border: 'none',
        },
        '.cm-activeLine': { backgroundColor: 'var(--bg-elev)' },
        '.cm-activeLineGutter': { backgroundColor: 'var(--bg-elev)', color: 'var(--fg)' },
        '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
        '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(37, 99, 235, 0.2)' },
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

  return {
    view,
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