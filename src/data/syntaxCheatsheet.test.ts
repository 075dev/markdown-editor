/**
 * 语法速查数据的形状与覆盖面回归(add-006,add-007 扩充)。
 *
 * 哨兵意图:
 *   - 条目数下限锁定契约覆盖面,防止后续裁剪缩水(add-007:17/6/12/8/7/5);
 *   - kUML 节所有「标识符(」调用必须命中官方验证白名单 —— 该节只允许
 *     三来源验证过的 Kotlin DSL 构造(GitHub README Quick Start /
 *     kuml.dev/llm / 官方 examples),白名单外的新增一律视为臆造拦截;
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

  it('每节条目数达到契约下限(17/6/12/8/7/5)', () => {
    const minimums: Record<string, number> = {
      'markdown-basics': 17,
      'gfm-extended': 6,
      math: 12,
      mermaid: 8,
      plantuml: 7,
      kuml: 5,
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

  it('kUML 节所有调用都在官方验证白名单内(防臆造构造的回归哨兵)', () => {
    // 三来源:README Quick Start / kuml.dev/llm / 官方 examples
    // kuml-getting-started.kuml.kts。块形式构造(source { })与属性赋值
    // (aggregation = ...)不跟「(」,天然不在扫描范围。
    const KUML_VERIFIED_CALLS = new Set([
      'classDiagram',
      'classOf',
      'enumOf',
      'literal',
      'attribute',
      'operation',
      'association',
      'multiplicity',
      'sequenceDiagram',
      'lifeline',
      'message',
      'reply',
      'c4Model',
      'person',
      'softwareSystem',
      'relationship',
      'systemContextDiagram',
      'include',
    ])
    const kuml = cheatSections.find((s) => s.id === 'kuml')
    expect(kuml).toBeDefined()
    for (const entry of kuml!.entries) {
      // 先剥离字符串字面量:message label 等文本里可能出现 foo( 样式内容
      // (官方示例即有 label = "processPayment(order)"),并非 DSL 调用
      const codeOnly = entry.snippet.replace(/"(?:[^"\\]|\\.)*"/g, '')
      const calls = [...codeOnly.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)].map(
        (m) => m[1],
      )
      expect(calls.length, `kUML 条目 ${entry.id} 应包含 DSL 调用`).toBeGreaterThan(0)
      for (const call of calls) {
        expect(
          KUML_VERIFIED_CALLS.has(call),
          `kUML 条目 ${entry.id} 出现未验证调用 ${call}()`,
        ).toBe(true)
      }
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
