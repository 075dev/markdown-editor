import { unified, type Processor } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import { plantumlRehype, resolvePlantumlServerUrl } from './plantumlRehype'
import { plantumlHighlight } from './plantumlHighlight'
import { buildCodeHighlightPlugin, disposeHighlighter } from './codeHighlight'
import { stripDiagramCode } from './stripDiagramCode'

/**
 * Markdown → 安全的 HTML 渲染管线：
 *
 *   1. remark-parse + remark-gfm → mdast
 *   2. remark-rehype → hast（保留原始 HTML，allowDangerousHtml）
 *   3. stripDiagramCode  (rehype)                    ← 把 mermaid/plantuml 提前扁平化（不再走代码高亮）
 *   4. codeHighlight     (正则在 hast 加 span.hl-X)  ← 通用代码块高亮（同步、零依赖、零 wasm）
 *   5. plantumlHighlight (自写)                     ← PlantUML 关键字着色
 *   6. plantumlRehype                                ← PlantUML <pre> → <img>
 *   7. rehype-sanitize                               ← XSS 过滤
 *   8. rehype-stringify
 *
 * 设计要点：
 *   - 同步高亮，wasm / onig 之类不在预览期加载，避免和 Tauri WebView onig 加载时机 conflict。
 *   - sanitize 仍然夹在最后，确保 hl-* span 不会带危险属性。
 *   - 主题通过 CSS class（`.hl-keyword` 等）+ :root[data-theme] 直接切换，
 *     不需要热重渲染即可切换。
 */

// 在默认 sanitize 之上追加白名单：允许 Mermaid / KaTeX / Shiki 节点。
// 默认 schema 已经允许常见的格式化标签，但禁止脚本与危险协议。
const sanitizeSchema: typeof defaultSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...((defaultSchema.attributes && defaultSchema.attributes.code) || []),
      ['className', /^language-/],
    ],
    span: [
      ...((defaultSchema.attributes && defaultSchema.attributes.span) || []),
      ['className'],
      ['style'], // Shiki 用 --shiki-light/--shiki-dark 内联 CSS 变量
    ],
    div: [
      ...((defaultSchema.attributes && defaultSchema.attributes.div) || []),
      ['className'],
    ],
    pre: [
      ...((defaultSchema.attributes && defaultSchema.attributes.pre) || []),
      ['className'],
      ['style'],
    ],
    '*': [
      ...((defaultSchema.attributes && defaultSchema.attributes['*']) || []),
      'className',
      'style',
    ],
  },
  tagNames: [
    ...((defaultSchema.tagNames as string[] | undefined) ?? []),
    'div',
    'figure',
    'figcaption',
  ],
}

let initialized: Promise<Processor<undefined, undefined, undefined, undefined, string>> | null =
  null

/**
 * 构造（或返回缓存的）渲染处理器。
 * 第一次调用时构造正则高亮器，后续直接复用（同进程同语言无副作用）。
 */
export function getProcessor(): Promise<Processor<undefined, undefined, undefined, undefined, string>> {
  if (initialized) return initialized
  initialized = (async () => {
    const codeHighlight = await buildCodeHighlightPlugin()
    const serverUrl = await resolvePlantumlServerUrl()
    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: true })
      // 把 mermaid / plantuml 代码块提前扁平化为纯文本 src，
      // 避免后续的正则高亮把 hl-* 撒进去、被后续 plantumlRehype 误处理。
      .use(stripDiagramCode)
      // 通用代码块高亮（在 plantumlRehype 之前；不感知 mermaid/plantuml）
      .use(codeHighlight)
      // PlantUML 自写高亮：必须在 plantumlRehype 之前
      .use(plantumlHighlight)
      // PlantUML <pre> → <img>：必须在 sanitize 之前
      .use(plantumlRehype, { format: 'svg', serverUrl })
      .use(rehypeSanitize, sanitizeSchema)
      .use(rehypeStringify)
    return processor as unknown as Processor<undefined, undefined, undefined, undefined, string>
  })()
  return initialized
}

/**
 * 渲染 Markdown 源为安全 HTML。
 */
export async function renderMarkdown(source: string): Promise<string> {
  const processor = await getProcessor()
  const file = await processor.process(source)
  return String(file)
}

/**
 * 测试或卸载时调用：释放 Shiki 高亮器实例，重置处理器缓存。
 */
export async function resetProcessor(): Promise<void> {
  if (initialized) {
    initialized = null
  }
  await disposeHighlighter()
}