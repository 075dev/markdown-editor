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
}

export interface CreatedEditor {
  view: EditorView
  setValue: (value: string) => void
  getValue: () => string
  setDark: (dark: boolean) => void
  scrollToLine: (line: number) => void
  destroy: () => void
}

/**
 * 创建 CodeMirror 6 编辑器实例，并返回一组桥接到 Vue 的方法。
 * 该工厂被设计成可独立测试，所以不直接依赖 Vue 的 ref / lifecycle。
 */
export function createMarkdownEditor(parent: HTMLElement, options: CreateEditorOptions = {}): CreatedEditor {
  const themeCompartment = new Compartment()
  let lastDoc = options.initialDoc ?? ''

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
      themeCompartment.of([]),
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '14px',
          fontFamily: 'var(--font-mono)',
          backgroundColor: 'var(--bg)',
          color: 'var(--fg)',
        },
        '.cm-scroller': {
          fontFamily: 'var(--font-mono)',
          lineHeight: '1.65',
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
        effects: themeCompartment.reconfigure([]),
      })
      void dark // 未来扩展：注入暗色主题 compartment
    },
    scrollToLine: (line) => {
      const block = view.lineBlockAt(view.state.doc.line(Math.max(1, line)).from)
      view.scrollDOM.scrollTo({ top: block.top - 16, behavior: 'smooth' })
    },
    destroy: () => view.destroy(),
  }
}