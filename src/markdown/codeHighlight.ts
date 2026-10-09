/**
 * 代码块高亮：基于正则的关键字 + 字符串 + 注释上色。
 *
 * 为何不接 shiki / prismjs / highlight.js：
 *   - shiki-rehype 在 Tauri WebView 真实运行里出现 'children' in undefined 崩溃
 *     （visit-parents 内部的 'in' 操作；具体堆栈已贴过）。
 *   - 重量级高亮库都依赖 wasm / 异步加载，与我们 markdown 即时预览的理念不符。
 *   - milkup 这种现代同类项目也完全不用 shiki，直接走 CM 自带 + 主题 CSS。
 *
 * 设计：
 *   - 同步、零依赖、零 wasm。
 *   - 给常见语言（js/ts/jsx/tsx/python/go/rust/css/html）一组 Tokenizer，
 *     输出 hast span 带 hl-* class，与现有 CSS 主题兼容。
 *   - 不识别的语言：原样保留 <pre class="language-X"><code>{text}</code></pre>，
 *     仍走我们的等宽字体 + 颜色。
 *   - sanitizer 之后的 sanitized HTML 仍允许我们的 hl-* class。
 */

import type { Plugin } from 'unified'
import type { Root, Element, ElementContent, Text, Properties } from 'hast'
import { visit } from 'unist-util-visit'

/**
 * 一个非常简单的 regex tokenizer：
 *   - 返回的 token 类型决定 CSS class（hl-keyword / hl-string / hl-comment / hl-number）
 *   - 对未知 token 类型 → plain text（无 class）
 *   - 同一行内多个命中 → 按位置切片拼回
 *
 * 注意：每个 regex 都加 'g' flag，让我们能在 tokenize 里用 lastIndex。
 */
interface TokenRule {
  type: 'keyword' | 'string' | 'comment' | 'number' | 'operator'
  /** 必须带 g flag；regex 内的捕获组不会被使用，仅用于优先级 */
  regex: RegExp
}
interface SimpleTokenizer {
  lang: string
  rules: TokenRule[]
}

const TOKENIZERS: SimpleTokenizer[] = [
  // JavaScript / TypeScript / JSX / TSX
  {
    lang: 'javascript',
    rules: [
      { type: 'comment', regex: /\/\/[^\n]*|\/\*[\s\S]*?\*\// },
      { type: 'string', regex: /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/ },
      { type: 'keyword', regex: /\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|default|break|continue|class|extends|new|this|super|import|export|from|as|async|await|yield|throw|try|catch|finally|typeof|instanceof|in|of|void|delete|null|undefined|true|false)\b/ },
      { type: 'number', regex: /\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/ },
    ],
  },
  {
    lang: 'typescript',
    rules: [
      { type: 'comment', regex: /\/\/[^\n]*|\/\*[\s\S]*?\*\//g },
      { type: 'string', regex: /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g },
      { type: 'keyword', regex: /\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|default|break|continue|class|extends|implements|interface|type|enum|namespace|module|declare|new|this|super|import|export|from|as|async|await|yield|throw|try|catch|finally|typeof|instanceof|in|of|void|delete|null|undefined|true|false|public|private|protected|readonly|static|abstract|get|set)\b/g },
      { type: 'number', regex: /\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g },
    ],
  },
  // Python
  {
    lang: 'python',
    rules: [
      { type: 'comment', regex: /#[^\n]*/g },
      // 三引号字符串优先；普通字符串同样支持
      { type: 'string', regex: /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/ },
      { type: 'keyword', regex: /\b(?:def|class|return|if|elif|else|for|while|break|continue|import|from|as|with|try|except|finally|raise|pass|yield|lambda|global|nonlocal|True|False|None|and|or|not|is|in)\b/ },
      { type: 'number', regex: /\b\d+(?:\.\d+)?\b/ },
    ],
  },
  // Go
  {
    lang: 'go',
    rules: [
      { type: 'comment', regex: /\/\/[^\n]*|\/\*[\s\S]*?\*\//g },
      { type: 'string', regex: /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g },
      { type: 'keyword', regex: /\b(?:func|var|const|type|struct|interface|package|import|return|if|else|for|range|switch|case|default|break|continue|go|defer|chan|select|map|true|false|nil|iota)\b/g },
      { type: 'number', regex: /\b\d+(?:\.\d+)?\b/g },
    ],
  },
  // Rust
  {
    lang: 'rust',
    rules: [
      { type: 'comment', regex: /\/\/[^\n]*|\/\*[\s\S]*?\*\//g },
      { type: 'string', regex: /"(?:\\.|[^"\\])*"/g },
      { type: 'keyword', regex: /\b(?:fn|let|mut|const|static|struct|enum|impl|trait|pub|use|mod|crate|self|super|return|if|else|match|for|while|loop|break|continue|as|in|where|move|ref|async|await|dyn|true|false)\b/g },
      { type: 'number', regex: /\b\d+(?:\.\d+)?\b/g },
    ],
  },
  // CSS
  {
    lang: 'css',
    rules: [
      { type: 'comment', regex: /\/\*[\s\S]*?\*\//g },
      { type: 'string', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g },
      { type: 'keyword', regex: /@[\w-]+|[a-z-]+(?=\s*:)/gi },
      { type: 'number', regex: /-?\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms)?\b/g },
    ],
  },
  // JSON
  {
    lang: 'json',
    rules: [
      { type: 'string', regex: /"(?:\\.|[^"\\])*"/g },
      { type: 'keyword', regex: /\b(?:true|false|null)\b/g },
      { type: 'number', regex: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g },
    ],
  },
  // HTML / XML / Vue template 都共享关键词
  {
    lang: 'html',
    rules: [
      { type: 'comment', regex: /<!--[\s\S]*?-->/g },
      { type: 'keyword', regex: /<\/?[a-zA-Z][\w-]*|>/g },
      { type: 'string', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g },
    ],
  },
]

const LANG_MAP = new Map<string, SimpleTokenizer>(
  TOKENIZERS.map((t) => [t.lang, t]),
)
// 别名
LANG_MAP.set('js', LANG_MAP.get('javascript')!)
LANG_MAP.set('jsx', LANG_MAP.get('javascript')!)
LANG_MAP.set('ts', LANG_MAP.get('typescript')!)
LANG_MAP.set('tsx', LANG_MAP.get('typescript')!)
LANG_MAP.set('py', LANG_MAP.get('python')!)
LANG_MAP.set('rs', LANG_MAP.get('rust')!)
LANG_MAP.set('vue', LANG_MAP.get('html')!)
LANG_MAP.set('xml', LANG_MAP.get('html')!)

/**
 * 已知我们做了拦截的语言（与 stripDiagramCode 保持一致）。
 * 这些 fenced code 不再走本插件——已被 stripDiagramCode 提前扁平化。
 * 我们再显式列出以做额外防御：万一上游插件顺序改了也不会被染色。
 */
const EXCLUDED_LANGS = new Set(['mermaid', 'plantuml', 'puml'])

/**
 * Build a unified plugin (function) for highlighting `<pre><code>` blocks.
 *
 * 行为：
 *   - 找 <pre> 内 <code>，看 className 上 `language-X`
 *   - 命中我们的 token table：把 code 的文本节点拆分，裹上 hl-* class 的 span
 *   - 命中 EXCLUDED_LANGS：不动（前一个 plugin 已处理），保持原样
 *   - 其他：原样保留 code 文本（无 token，但有等宽字体 className）
 */
export async function buildCodeHighlightPlugin(): Promise<Plugin> {
  // unified plugin 签名：(this: Processor, ...options) => transformer
  // 我们不需要 options —— 使用默认值。
  const plugin = function () {
    return (tree: Root) => {
      visit(tree, 'element', (node: Element, index, parent) => {
        if (!parent || index === undefined || index === null) return
        if (node.tagName !== 'pre') return

        const preChildren = (node.children ?? []) as ElementContent[]
        const codeChild = preChildren.find(
          (c): c is Element => c.type === 'element' && c.tagName === 'code',
        )
        if (!codeChild) return

        const lang = getLanguageFromCode(codeChild)
        if (EXCLUDED_LANGS.has(lang)) return

        const tokenizer = LANG_MAP.get(lang)
        const text = collectPlainText(codeChild)
        if (!text) return

        if (!tokenizer) return

        const newChildren = tokenize(text, tokenizer)
        codeChild.children = newChildren
      })
    }
  }
  // unified plugin 实际类型是 Transformer / Attacher 的并集；
  // 为了简单，挂上去时我们强转。
  return plugin as unknown as Plugin
}

/**
 * jsdom / 沙箱兼容：返回 noop plugin，保持 pipeline 形态不变。
 */
export async function disposeHighlighter(): Promise<void> {
  /* noop */
}

export function isJsdomEnvironment(): boolean {
  if (typeof navigator === 'undefined') return false
  return /jsdom/i.test(navigator.userAgent ?? '')
}

/**
 * 暴露给单元测试 + 调试 — 列表里支持的语言。
 */
export function listSupportedLanguages(): readonly string[] {
  return Array.from(LANG_MAP.keys()).filter((k) => !EXCLUDED_LANGS.has(k))
}

/* ---------- 内部 ---------- */

function getLanguageFromCode(codeEl: Element): string {
  const classes = (codeEl.properties?.className ?? []) as Array<string | number>
  for (const c of classes) {
    if (typeof c === 'string' && c.startsWith('language-')) {
      return c.slice('language-'.length).toLowerCase()
    }
  }
  return ''
}

function collectPlainText(el: Element): string {
  if (!el.children || el.children.length === 0) {
    // 罕见：code 没 children —— 直接取 textContent（应在 <pre> 阶段就有 children）
    return (el as unknown as { value?: string }).value ?? ''
  }
  const parts: string[] = []
  for (const c of el.children) {
    if (c.type === 'text') {
      parts.push((c as Text).value)
    } else if (c.type === 'element') {
      parts.push(collectPlainText(c))
    }
  }
  return parts.join('')
}

/**
 * Tokenize 把一段纯文本切成有序的 span/纯文本节点序列。
 * 实现：合并所有 token 正则 → 按位置排序 → 切片 → 拼回，gap 用纯文本填充。
 */
function tokenize(text: string, tk: SimpleTokenizer): ElementContent[] {
  if (!text) return []
  const hits: Array<{ start: number; end: number; type: string }> = []
  const len = text.length
  let i = 0
  while (i < len) {
    let matched = false
    // 在 text.slice(i) 上 exec —— exec 不依赖 lastIndex，无 g flag 也安全。
    const remaining = text.slice(i)
    for (const rule of tk.rules) {
      const m = rule.regex.exec(remaining)
      if (m && m.index === 0 && m[0].length > 0) {
        hits.push({ start: i, end: i + m[0].length, type: rule.type })
        i += m[0].length
        matched = true
        break
      }
    }
    if (!matched) i++
  }
  if (hits.length === 0) return [{ type: 'text', value: text }]

  // 移除重叠：保留先匹配到的
  const pruned: typeof hits = []
  let lastEnd = 0
  for (const h of hits) {
    if (h.start < lastEnd) continue
    pruned.push(h)
    lastEnd = h.end
  }

  const out: ElementContent[] = []
  let cursor = 0
  for (const h of pruned) {
    if (h.start > cursor) {
      out.push({ type: 'text', value: text.slice(cursor, h.start) })
    }
    out.push({
      type: 'element',
      tagName: 'span',
      properties: { className: [`hl-${h.type}`] } as Properties,
      children: [{ type: 'text', value: text.slice(h.start, h.end) }],
    })
    cursor = h.end
  }
  if (cursor < text.length) {
    out.push({ type: 'text', value: text.slice(cursor) })
  }
  return out
}
