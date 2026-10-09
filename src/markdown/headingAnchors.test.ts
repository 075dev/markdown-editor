import { describe, expect, it } from 'vitest'
import type { Element, Root } from 'hast'
import { headingAnchors, slugifyHeading } from '@/markdown/headingAnchors'
import { renderMarkdown } from '@/markdown/pipeline'

function heading(tagName: string, text: string, props?: Element['properties']): Element {
  return {
    type: 'element',
    tagName,
    properties: props ?? {},
    children: [{ type: 'text', value: text }],
  }
}

function root(...children: Element[]): Root {
  return { type: 'root', children }
}

describe('slugifyHeading', () => {
  it('lowercases ASCII and folds whitespace to dashes', () => {
    expect(slugifyHeading('Getting Started')).toBe('getting-started')
  })

  it('folds consecutive whitespace into a single dash', () => {
    expect(slugifyHeading('Foo   Bar')).toBe('foo-bar')
  })

  it('keeps CJK characters untouched', () => {
    expect(slugifyHeading('安装')).toBe('安装')
  })

  it('strips ASCII punctuation but keeps CJK and existing dashes', () => {
    expect(slugifyHeading('安装 Guide!')).toBe('安装-guide')
    expect(slugifyHeading('a - b_2?')).toBe('a---b_2')
  })

  it('falls back to "heading" for empty or all-punctuation titles', () => {
    expect(slugifyHeading('')).toBe('heading')
    expect(slugifyHeading('   ')).toBe('heading')
    expect(slugifyHeading('!!!???')).toBe('heading')
  })
})

describe('headingAnchors plugin', () => {
  it('injects slug id into h1-h6 headings', () => {
    const tree = root(
      heading('h1', 'Top Title'),
      heading('h2', 'Getting Started'),
      heading('h3', 'Section Three'),
      heading('h4', 'Deep Four'),
      heading('h5', 'Deeper Five'),
      heading('h6', 'Deepest Six'),
    )
    headingAnchors()(tree)
    const ids = tree.children.map((c) => (c as Element).properties?.id)
    expect(ids).toEqual([
      'top-title',
      'getting-started',
      'section-three',
      'deep-four',
      'deeper-five',
      'deepest-six',
    ])
  })

  it('keeps CJK slug as-is', () => {
    const tree = root(heading('h2', '安装'))
    headingAnchors()(tree)
    expect((tree.children[0] as Element).properties?.id).toBe('安装')
  })

  it('handles mixed CJK/ASCII/punctuation heading', () => {
    const tree = root(heading('h2', '安装 Guide!'))
    headingAnchors()(tree)
    expect((tree.children[0] as Element).properties?.id).toBe('安装-guide')
  })

  it('collects text through inline markup (em/code)', () => {
    const tree = root({
      type: 'element',
      tagName: 'h2',
      properties: {},
      children: [
        { type: 'text', value: 'Foo ' },
        { type: 'element', tagName: 'em', properties: {}, children: [{ type: 'text', value: 'Bar' }] },
      ],
    })
    headingAnchors()(tree)
    expect((tree.children[0] as Element).properties?.id).toBe('foo-bar')
  })

  it('dedupes duplicate slugs with -1/-2 suffixes', () => {
    const tree = root(heading('h2', '同名'), heading('h3', '同名'), heading('h4', '同名'))
    headingAnchors()(tree)
    expect(tree.children.map((c) => (c as Element).properties?.id)).toEqual([
      '同名',
      '同名-1',
      '同名-2',
    ])
  })

  it('does not overwrite an existing id', () => {
    const tree = root(heading('h2', 'Custom Here', { id: 'my-own-id' }))
    headingAnchors()(tree)
    expect((tree.children[0] as Element).properties?.id).toBe('my-own-id')
  })

  it('avoids generated slugs colliding with an existing explicit id', () => {
    const tree = root(heading('h2', 'Custom Here', { id: 'custom-here' }), heading('h3', 'Custom Here'))
    headingAnchors()(tree)
    expect((tree.children[1] as Element).properties?.id).toBe('custom-here-1')
  })

  it('ignores non-heading elements', () => {
    const tree = root({
      type: 'element',
      tagName: 'p',
      properties: {},
      children: [{ type: 'text', value: 'Just A Paragraph' }],
    })
    headingAnchors()(tree)
    expect((tree.children[0] as Element).properties?.id).toBeUndefined()
  })

  it('restarts dedupe counter for each tree (no cross-document leak)', () => {
    const transformer = headingAnchors()
    const docA = root(heading('h2', '同名'), heading('h3', '同名'))
    const docB = root(heading('h2', '同名'))
    transformer(docA)
    transformer(docB)
    expect((docA.children[0] as Element).properties?.id).toBe('同名')
    expect((docA.children[1] as Element).properties?.id).toBe('同名-1')
    // 第二篇文档的首个同名标题不能带上上一篇泄漏的 -1
    expect((docB.children[0] as Element).properties?.id).toBe('同名')
  })
})

describe('renderMarkdown integration — heading anchors', () => {
  it('keeps generated id attribute after sanitizer', async () => {
    // 关键锁定:rehype-sanitize 不得剥离 h1-h6 的 id(否则 #锚点 全部失效)
    const html = await renderMarkdown('## Getting Started')
    expect(html).toContain('<h2 id="getting-started">')
  })

  it('renders CJK heading with its slug id', async () => {
    const html = await renderMarkdown('## 安装')
    expect(html).toContain('<h2 id="安装">')
  })

  it('dedupes duplicate headings inside one document', async () => {
    const html = await renderMarkdown('## Same\n\n## Same\n\n## Same')
    expect(html).toContain('id="same"')
    expect(html).toContain('id="same-1"')
    expect(html).toContain('id="same-2"')
  })

  it('same processor consecutive renders do not leak dedupe counter', async () => {
    // getProcessor() 缓存同一 processor 实例:连续渲染两篇相同标题的文档,
    // 第二篇首个标题的 slug 必须不带 -1
    await renderMarkdown('## Dup')
    const html2 = await renderMarkdown('## Dup')
    expect(html2).toContain('id="dup"')
    expect(html2).not.toContain('id="dup-1"')
  })

  it('falls back to "heading" for an all-punctuation title', async () => {
    const html = await renderMarkdown('## !!!')
    expect(html).toContain('id="heading"')
  })
})
