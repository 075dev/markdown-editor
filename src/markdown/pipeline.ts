import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import { plantumlRehype } from './plantumlRehype'

// 在默认 sanitize 之上追加白名单：允许 Mermaid / KaTeX 节点。
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
    ],
    div: [
      ...((defaultSchema.attributes && defaultSchema.attributes.div) || []),
      ['className'],
    ],
    // KaTeX 输出大量 className，需要放行
    '*': [
      ...((defaultSchema.attributes && defaultSchema.attributes['*']) || []),
      'className',
      'style',
      // PlantUML 插件把源码挂在 data-* 属性上；默认 schema 已允许任意 data-* 前缀
    ],
  },
  // 显式允许 div / pre / img 标签（图容器 + 降级源码）
  tagNames: [
    ...((defaultSchema.tagNames as string[] | undefined) ?? []),
    'div',
    'figure',
    'figcaption',
  ],
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  // PlantUML 必须在 remark-rehype 之后、rehype-sanitize 之前
  .use(plantumlRehype, { format: 'svg' })
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeStringify)

/**
 * 将 Markdown 源文本安全地转换为 HTML。
 * 注意：仍然保留了 allowDangerousHtml 是为了让 sanitize 在 hast 层兜底；
 * sanitize 之后的字符串不会再包含 <script> / javascript: 链接等危险内容。
 */
export async function renderMarkdown(source: string): Promise<string> {
  const file = await processor.process(source)
  return String(file)
}

export { processor as markdownProcessor }