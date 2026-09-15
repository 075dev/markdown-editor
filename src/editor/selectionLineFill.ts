/**
 * 选区补色扩展：
 * CodeMirror 6 的 drawSelection 只对 selection 区间内的 inline 文本加背景，
 * 当 selection 一直延伸到某行末尾时，**该行的最后一个字符之后的"选中宽度"**
 * 会缩到 0（因为没有可见字符了），视觉上看起来像「最后一行没上色」。
 *
 * 解决思路：用一个 ViewPlugin 监听 selection 变化，
 * 对 selection 经过的「每一整行」（包括最后一行）加 line decoration，
 * 染上一层轻量的背景色。
 *
 * 与 drawSelection 的内联样式叠加 ⇒ 实际看到的颜色会更均匀。
 */

import { EditorView, Decoration, ViewPlugin } from '@codemirror/view'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import { EditorState, RangeSetBuilder } from '@codemirror/state'

function selectionLineDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  // 主选区足够；副选区在 Markdown 编辑器里基本没用到，忽略。
  const ranges = state.selection.ranges
  if (ranges.length === 0) {
    return builder.finish()
  }
  const doc = state.doc
  for (const r of ranges) {
    if (r.empty) continue
    const fromLine = doc.lineAt(r.from).number
    // 把 to 位置取所在行的 number；对于「选到行末（含 \n）」这种情况，
    // selection 的 to 通常等于下一行的 from - 1，即 \n 字符本身的位置
    // —— doc.lineAt(to).number 仍会返回 to 所在行；它正是我们想高亮的「最后一行」。
    let toLine = doc.lineAt(r.to).number
    // 边界修：selection 的 to 落在 \n 上时 lineAt 会返回「下一行」，这导致
    // 用户期望高亮的最后一行被吞掉。我们再降一行：
    if (toLine > fromLine && r.to <= doc.line(toLine).from) {
      toLine -= 1
    }
    if (toLine < fromLine) continue
    for (let n = fromLine; n <= toLine; n++) {
      const line = doc.line(n)
      builder.add(line.from, line.from, Decoration.line({ attributes: { class: 'cm-line--mde-selected' } }))
    }
  }
  return builder.finish()
}

export const selectionLineFill = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = selectionLineDecorations(view.state)
    }
    update(u: ViewUpdate) {
      if (u.selectionSet || u.docChanged || u.viewportChanged) {
        this.decorations = selectionLineDecorations(u.state)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

/** 配套 CSS。淡强调底(--accent-soft),叠加在选区上仍可辨识;
 * 颜色走主题 token,六主题 + system 自动跟随(无需 cm-dark 分支)。 */
export const selectionLineFillTheme = EditorView.theme({
  '.cm-line.cm-line--mde-selected': {
    backgroundColor: 'var(--accent-soft)',
  },
})
