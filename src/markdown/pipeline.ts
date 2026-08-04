import { unified, type Processor } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import { plantumlRehype } from './plantumlRehype'
import { plantumlHighlight } from './plantumlHighlight'
import { buildCodeHighlightPlugin, disposeHighlighter } from './codeHighlight'

/**
 * Markdown → 安全的 HTML 渲染管线：
 *
 *   1. remark-parse + remark-gfm → mdast
 *   2. remark-rehype → hast（保留原始 HTML，allowDangerousHtml）
 *   3. codeHighlight       (shiki @shikijs/rehype)        ← 通用代码块
 *   4. plantumlHighlight   (自写)                          ← PlantUML 关键字着色
 *   5. plantumlRehype                                      ← PlantUML <pre> → <img>
 *   6. rehype-sanitize                                     ← XSS 过滤
 *   7. rehype-stringify
 *
 * 设计要点：
 *   - Shiki 高亮器在首次调用 renderMarkdown 前异步初始化一次并复用；
 *     同一进程里多次渲染不会重复加载 wasm。
 *   - sanitize 仍然夹在最后，确保 hl-* / shiki span 不会带危险属性。
 *   - 主题通过 CSS 变量 `--shiki-light` / `--shiki-dark` 切换，应用主题
 *     改变时只需要 reload（无需重新渲染）。
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
 * 第一次调用时初始化 Shiki highlighter，后续直接复用。
 */
export function getProcessor(): Promise<Processor<undefined, undefined, undefined, undefined, string>> {
  if (initialized) return initialized
  initialized = (async () => {
    const codeHighlight = await buildCodeHighlightPlugin()
    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: true })
      // Shiki 高亮必须在 plantumlRehype 之前、remarkRehype 之后
      .use(codeHighlight)
      // PlantUML 自写高亮：必须在 plantumlRehype 之前
      .use(plantumlHighlight)
      // PlantUML <pre> → <img>：必须在 sanitize 之前
      .use(plantumlRehype, { format: 'svg' })
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