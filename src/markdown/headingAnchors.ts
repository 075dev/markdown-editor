import type { Element, Root, Text } from 'hast'
import { visit } from 'unist-util-visit'

/**
 * Heading 锚点 rehype 插件(add-002 契约 · 行为细则 3):
 *
 * 为 h1–h6 注入 GitHub 风格的 slug id,供预览内 `#锚点` 链接平滑滚动定位:
 *   - 递归收集标题文本 → trim → ASCII 大写转小写
 *   - 空白序列(含连续空格 / tab)折叠为单个 `-`
 *   - 移除 ASCII 标点(保留 ASCII 字母 / 数字 / `-` / `_`;非 ASCII 字符如中日韩全部保留)
 *   - 空 / 全标点标题兜底为 `heading`——选择字面兜底而非 `-` 开头处理,
 *     避免产生形如 `-1` 的锚点(以 `-` 开头的 id 在部分 CSS/选择器场景需要转义,不友好)
 *   - 同文档重名追加 `-1`/`-2` 递增
 *
 * 生命周期:去重计数在 transformer 每次被调用(即 unified 每次 process 一棵树)
 * 时重新初始化——同一 processor 连续渲染多篇文档,计数不跨文档泄漏。
 */

/** ASCII 标点:0x21–0x7E 中除字母、数字、`-`(0x2D)、`_`(0x5F)之外的全部字符 */
const ASCII_PUNCTUATION = /[\u0021-\u002C\u002E-\u002F\u003A-\u0040\u005B-\u005E\u0060\u007B-\u007E]/g

const HEADING_TAG = /^h[1-6]$/

/** 递归收集标题节点的纯文本内容(穿透内联标记如 *em*、`code`) */
function collectText(node: Element): string {
  let out = ''
  for (const child of node.children) {
    if (child.type === 'text') {
      out += (child as Text).value
    } else if (child.type === 'element') {
      out += collectText(child as Element)
    }
  }
  return out
}

/**
 * GitHub 风格 slug:ASCII 小写 + 空白折叠为 `-` + 去 ASCII 标点(CJK 保留)。
 * 导出供测试直接断言规则本身。
 */
export function slugifyHeading(raw: string): string {
  const slug = raw
    .trim()
    // 仅 ASCII 大写转小写(不用 String.toLowerCase,避免波及非 ASCII 的特殊大小写规则)
    .replace(/[A-Z]/g, (c) => c.toLowerCase())
    // 空白序列(含连续空格 / tab)折叠为单个 `-`
    .replace(/\s+/g, '-')
    // 去 ASCII 标点(保留字母 / 数字 / `-` / `_` / 全部非 ASCII)
    .replace(ASCII_PUNCTUATION, '')
  // 空 / 全标点标题兜底,保证 id 永远非空
  return slug === '' ? 'heading' : slug
}

/**
 * unified 插件(rehype 阶段)。
 *
 * 必须在 `rehypeSanitize` 之前使用,并确保 sanitize schema
 * 放行 h1–h6 的 `id` 属性(见 pipeline.ts 中 sanitizeSchema)。
 *
 * 类型说明:不用 `Plugin<[], Root, Root>` 标注 —— 那会让 `headingAnchors()`
 * 的返回类型变成 unified 的 `Transformer | void`(带 next 回调、可能 undefined),
 * 单测无法直接 `headingAnchors()(tree)`。这里显式声明为
 * 「工厂返回单参同步 transformer」,既满足 `.use(headingAnchors)`,
 * 又让直接调用拿到干净的 `(tree: Root) => void`。
 */
export const headingAnchors: () => ((tree: Root) => void) = (): ((tree: Root) => void) => {
  const transformer = (tree: Root): void => {
    // 每次 process 一棵新树 → 独立的去重空间(见上方生命周期注释)
    const seen = new Map<string, number>()
    visit(tree, 'element', (node: Element) => {
      if (!HEADING_TAG.test(node.tagName)) return

      const existing = node.properties?.id
      if (existing !== undefined && existing !== null && existing !== '') {
        // 已有显式 id(用户 raw HTML / 上游注入)不覆盖,但计入去重空间,
        // 避免后续生成的 slug 与它撞出重复 id(HTML 规范要求 id 文档唯一)。
        const key = String(existing)
        seen.set(key, (seen.get(key) ?? 0) + 1)
        return
      }

      const base = slugifyHeading(collectText(node))
      const count = seen.get(base) ?? 0
      seen.set(base, count + 1)
      node.properties = { ...node.properties, id: count === 0 ? base : `${base}-${count}` }
    })
  }

  return transformer
}
