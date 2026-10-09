/**
 * 语法速查数据的形状与覆盖面回归(add-006)。
 *
 * 哨兵意图:
 *   - 条目数下限锁定契约覆盖面,防止后续裁剪缩水;
 *   - kUML 节所有 snippet 必须含 "classDiagram" —— 防止臆造的
 *     非 DSL 构造混进 kUML 节(该节只允许官方验证过的 Kotlin DSL);
 *   - 围栏开合检查保证照抄进编辑器的示例本身是合法 Markdown。
 */
import { describe, expect, it } from 'vitest'
import { cheatSections } from '@/data/syntaxCheatsheet'

describe('syntaxCheatsheet 数据', () => {
  it('恰好 6 节,id 与标题符合契约', () => {
    expect(cheatSections).toHaveLength(6)
    expect(cheatSections.map((s) => s.id)).toEqual([
      'markdown-basics',
      'gfm-extended',
      'math',
      'mermaid',
      'plantuml',
      'kuml',
    ])
    expect(cheatSections.map((s) => s.title)).toEqual([
      'Markdown 基础',
      'GFM 扩展',
      '数学(KaTeX)',
      'mermaid 图表',
      'PlantUML',
      'kUML',
    ])
  })

  it('每节条目数达到契约下限(10/5/3/3/3/2)', () => {
    const minimums: Record<string, number> = {
      'markdown-basics': 10,
      'gfm-extended': 5,
      math: 3,
      mermaid: 3,
      plantuml: 3,
      kuml: 2,
    }
    for (const section of cheatSections) {
      expect(section.entries.length, `节 ${section.id}`).toBeGreaterThanOrEqual(
        minimums[section.id],
      )
    }
  })

  it('全部节 id 与条目 id 唯一', () => {
    const sectionIds = cheatSections.map((s) => s.id)
    expect(new Set(sectionIds).size).toBe(sectionIds.length)

    const entryIds = cheatSections.flatMap((s) => s.entries.map((e) => e.id))
    expect(new Set(entryIds).size).toBe(entryIds.length)
  })

  it('每条 title / description / snippet 非空', () => {
    for (const section of cheatSections) {
      for (const entry of section.entries) {
        expect(entry.title.trim().length, `条目 ${entry.id} title`).toBeGreaterThan(0)
        expect(entry.description.trim().length, `条目 ${entry.id} description`).toBeGreaterThan(0)
        expect(entry.snippet.trim().length, `条目 ${entry.id} snippet`).toBeGreaterThan(0)
      }
    }
  })

  it('kUML 节所有 snippet 都含 classDiagram(防臆造构造的回归哨兵)', () => {
    const kuml = cheatSections.find((s) => s.id === 'kuml')
    expect(kuml).toBeDefined()
    for (const entry of kuml!.entries) {
      expect(entry.snippet, `kUML 条目 ${entry.id}`).toContain('classDiagram')
    }
  })

  it('以 ``` 开头的 snippet 围栏闭合(起始围栏数为偶数)', () => {
    for (const section of cheatSections) {
      for (const entry of section.entries) {
        if (!entry.snippet.trimStart().startsWith('```')) continue
        const fenceCount = (entry.snippet.match(/^```/gm) ?? []).length
        expect(fenceCount % 2, `条目 ${entry.id} 围栏应成对`).toBe(0)
        expect(fenceCount, `条目 ${entry.id} 应有开围栏`).toBeGreaterThanOrEqual(2)
      }
    }
  })
})
