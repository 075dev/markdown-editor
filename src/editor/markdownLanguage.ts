import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import type { Extension } from '@codemirror/state'

/**
 * CodeMirror 6 Markdown 语言扩展：
 * - 使用官方 `@codemirror/lang-markdown`，并把 language-data 中的全部语言作为代码块高亮支持
 * - 用 `@lezer/highlight` 提供一组轻量的 HighlightStyle，让标题/粗体/斜体/链接等可视
 */
export function markdownExtensions(): Extension[] {
  const md = markdown({
    codeLanguages: languages,
  })

  const highlighter = HighlightStyle.define([
    { tag: t.heading1, class: 'cm-md-heading cm-md-heading-1' },
    { tag: t.heading2, class: 'cm-md-heading cm-md-heading-2' },
    { tag: t.heading3, class: 'cm-md-heading cm-md-heading-3' },
    { tag: t.heading4, class: 'cm-md-heading cm-md-heading-4' },
    { tag: t.heading5, class: 'cm-md-heading cm-md-heading-5' },
    { tag: t.heading6, class: 'cm-md-heading cm-md-heading-6' },
    { tag: t.strong, class: 'cm-md-bold', fontWeight: 'bold' },
    { tag: t.emphasis, class: 'cm-md-italic', fontStyle: 'italic' },
    { tag: t.strikethrough, class: 'cm-md-strike' },
    { tag: t.link, class: 'cm-md-link' },
    { tag: t.url, class: 'cm-md-url' },
    { tag: t.monospace, class: 'cm-md-code' },
    { tag: t.list, class: 'cm-md-list' },
    { tag: t.quote, class: 'cm-md-quote', color: 'var(--text-2)', fontStyle: 'italic' },
  ])

  return [md, syntaxHighlighting(highlighter)]
}