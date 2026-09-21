import { describe, expect, it } from 'vitest'
import {
  classifyPreviewLink,
  resolveDocumentHref,
} from '@/markdown/linkResolution'

/**
 * 预览链接分类 + 文档跳转路径解析(add-002 T3)。
 * 契约:event-flow.md「文档链接跳转约定」行为细则 1/2 与边缘场景表。
 * resolveDocumentHref 输出统一为反斜杠归一形式(见模块注释)。
 */

describe('classifyPreviewLink(协议分类,大小写不敏感)', () => {
  it('#fragment → anchor,fragment 为 decodeURIComponent 后的锚文本', () => {
    expect(classifyPreviewLink('#安装')).toEqual({
      kind: 'anchor',
      fragment: '安装',
    })
  })

  it('百分号编码的中文锚点(href 由渲染管线编码)→ 解码', () => {
    expect(classifyPreviewLink('#%E5%AE%89%E8%A3%85')).toEqual({
      kind: 'anchor',
      fragment: '安装',
    })
  })

  it('锚点含空格编码(%20)→ 解码', () => {
    expect(classifyPreviewLink('#Readme%20Guide')).toEqual({
      kind: 'anchor',
      fragment: 'Readme Guide',
    })
  })

  it('非法百分号编码 → 解码失败容错,用原串', () => {
    expect(classifyPreviewLink('#bad%2zz')).toEqual({
      kind: 'anchor',
      fragment: 'bad%2zz',
    })
  })

  it('https → external(剥离 fragment)', () => {
    expect(classifyPreviewLink('https://example.com/a#sec')).toEqual({
      kind: 'external',
      fragment: 'sec',
    })
  })

  it('HTTP 大写协议 → external(大小写不敏感)', () => {
    expect(classifyPreviewLink('HTTP://EXAMPLE.COM/x')).toEqual({
      kind: 'external',
      fragment: null,
    })
  })

  it('mailto 带 query → external,保持完整、无 fragment', () => {
    expect(classifyPreviewLink('mailto:a@b.com?subject=hi')).toEqual({
      kind: 'external',
      fragment: null,
    })
  })

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'vbscript:MsgBox(1)',
  ])('危险协议 %s → ignored(双保险)', (href) => {
    expect(classifyPreviewLink(href)).toEqual({ kind: 'ignored', fragment: null })
  })

  it('空 href 与纯空白 → ignored', () => {
    expect(classifyPreviewLink('')).toEqual({ kind: 'ignored', fragment: null })
    expect(classifyPreviewLink('   ')).toEqual({ kind: 'ignored', fragment: null })
  })

  it.each([
    './sub/other.md',
    '../sibling.md',
    '/wiki/start.md',
    'C:\\notes\\x.md',
    'C:/notes/x.md',
  ])('相对/根相对/盘符路径 %s → document', (href) => {
    expect(classifyPreviewLink(href).kind).toBe('document')
  })

  it('document 带锚点 → fragment 剥离', () => {
    expect(classifyPreviewLink('../sibling.md#section')).toEqual({
      kind: 'document',
      fragment: 'section',
    })
  })

  it('白名单外协议(如 ftp)按契约归 document,不归 external', () => {
    expect(classifyPreviewLink('ftp://example.com/pub.txt').kind).toBe('document')
  })
})

describe('resolveDocumentHref(相对当前文档目录)', () => {
  const CUR = 'D:\\docs\\index.md'

  it('同目录相对路径 ./note.md → D:\\docs\\note.md', () => {
    expect(resolveDocumentHref(CUR, null, './note.md')).toBe('D:\\docs\\note.md')
  })

  it('裸文件名 note.md → 同目录', () => {
    expect(resolveDocumentHref(CUR, null, 'note.md')).toBe('D:\\docs\\note.md')
  })

  it('子目录 sub/note.md → D:\\docs\\sub\\note.md', () => {
    expect(resolveDocumentHref(CUR, null, 'sub/note.md')).toBe(
      'D:\\docs\\sub\\note.md',
    )
  })

  it('一级上跳 ../sibling.md → D:\\sibling.md', () => {
    expect(resolveDocumentHref(CUR, null, '../sibling.md')).toBe('D:\\sibling.md')
  })

  it('多级上跳 ../../x/y.md → D:\\x\\y.md', () => {
    expect(resolveDocumentHref('D:\\a\\b\\c.md', null, '../../x/y.md')).toBe(
      'D:\\x\\y.md',
    )
  })

  it('`.` 与 `..` 混合 ./sub/../note.md → 消解为 D:\\docs\\note.md', () => {
    expect(resolveDocumentHref(CUR, null, './sub/../note.md')).toBe(
      'D:\\docs\\note.md',
    )
  })

  it('跳不出盘符根的 .. 忽略(不丢盘符)', () => {
    expect(resolveDocumentHref('C:\\a\\b.md', null, '../../../x.md')).toBe(
      'C:\\x.md',
    )
  })

  it('currentPath 用正斜杠形式也能取目录', () => {
    expect(resolveDocumentHref('D:/docs/index.md', null, 'note.md')).toBe(
      'D:\\docs\\note.md',
    )
  })

  it('中文文件名百分号编码 → decodeURIComponent', () => {
    expect(resolveDocumentHref(CUR, null, './%E7%AC%94%E8%AE%B0.md')).toBe(
      'D:\\docs\\笔记.md',
    )
  })

  it('锚点剥离:other.md#sec → D:\\docs\\other.md', () => {
    expect(resolveDocumentHref(CUR, null, 'other.md#sec')).toBe(
      'D:\\docs\\other.md',
    )
  })

  it('无扩展名补 .md', () => {
    expect(resolveDocumentHref(CUR, null, 'intro')).toBe('D:\\docs\\intro.md')
  })

  it('隐藏文件式段(含点)不重复补扩展名', () => {
    expect(resolveDocumentHref(CUR, null, '.gitignore')).toBe('D:\\docs\\.gitignore')
  })

  it('currentPath 缺失 → null', () => {
    expect(resolveDocumentHref(null, 'D:\\wiki', 'note.md')).toBeNull()
  })
})

describe('resolveDocumentHref(/ 开头相对工作区根)', () => {
  it('/start.md 拼 rootPath → D:\\wiki\\start.md', () => {
    expect(resolveDocumentHref(null, 'D:\\wiki', '/start.md')).toBe(
      'D:\\wiki\\start.md',
    )
  })

  it('rootPath 带尾分隔符不重复拼接', () => {
    expect(resolveDocumentHref('D:\\docs\\index.md', 'D:\\wiki\\', '/start.md')).toBe(
      'D:\\wiki\\start.md',
    )
  })

  it('rootPath 缺失 → null(即使 currentPath 存在)', () => {
    expect(resolveDocumentHref('D:\\docs\\index.md', null, '/start.md')).toBeNull()
  })

  it('rootPath 为空串视为缺失 → null', () => {
    expect(resolveDocumentHref(null, '', '/start.md')).toBeNull()
  })

  it('无扩展名补 .md', () => {
    expect(resolveDocumentHref(null, 'D:\\wiki', '/start')).toBe('D:\\wiki\\start.md')
  })
})

describe('resolveDocumentHref(Windows 盘符绝对路径)', () => {
  it('反斜杠盘符路径原样归一返回', () => {
    expect(resolveDocumentHref('D:\\docs\\index.md', null, 'D:\\x\\y.md')).toBe(
      'D:\\x\\y.md',
    )
  })

  it('正斜杠盘符路径归一为反斜杠形式', () => {
    expect(resolveDocumentHref(null, null, 'C:/notes/intro')).toBe(
      'C:\\notes\\intro.md',
    )
  })

  it('绝对路径中的 .. 消解', () => {
    expect(resolveDocumentHref(null, null, 'D:\\x\\a\\..\\y.md')).toBe('D:\\x\\y.md')
  })
})
