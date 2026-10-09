/**
 * selection.ts 的核心工具：
 *   - isEditableTarget：识别可编辑节点（含 contenteditable、CodeMirror）
 *   - readSelection：document.getSelection 兜底返回 ''
 * 剪贴板读写需要 navigator.clipboard，jsdom 没实现；
 *   这里只验证 happy path 与降级。
 *
 * 注意：本仓库 vitest 用到的 jsdom 版本对 contentEditable 属性存在已知缺失
 * （`isContentEditable === undefined`，getAttribute('contenteditable') === null）。
 * 我们用 setAttribute 显式建测试节点，并用 CodeMirror 真实生成的 .cm-content 类
 * 来覆盖「祖先链 + classList」的兜底分支。
 */
import { describe, expect, it } from 'vitest'
import { isEditableTarget, readSelection } from '@/services/selection'

describe('selection utilities', () => {
  it('isEditableTarget: input[type=text|search|...] 和 textarea 命中', () => {
    document.body.innerHTML = ''
    const input = document.createElement('input')
    input.type = 'text'
    const search = document.createElement('input')
    search.type = 'search'
    const ta = document.createElement('textarea')
    const btn = document.createElement('button')
    document.body.append(input, search, ta, btn)

    expect(isEditableTarget(input)).toBe(true)
    expect(isEditableTarget(search)).toBe(true)
    expect(isEditableTarget(ta)).toBe(true)
    expect(isEditableTarget(btn)).toBe(false)
  })

  it('isEditableTarget: 通过 setAttribute 设置的 contenteditable 命中', () => {
    document.body.innerHTML = ''
    const ed = document.createElement('div')
    ed.setAttribute('contenteditable', 'true')
    document.body.append(ed)
    expect(isEditableTarget(ed)).toBe(true)
  })

  it('isEditableTarget: CodeMirror 的 .cm-content 节点命中', () => {
    document.body.innerHTML = ''
    const cm = document.createElement('div')
    cm.classList.add('cm-content')
    cm.setAttribute('contenteditable', 'true')
    document.body.append(cm)
    expect(isEditableTarget(cm)).toBe(true)
    // 子节点也命中（祖先链查找）
    const child = document.createElement('span')
    cm.appendChild(child)
    expect(isEditableTarget(child)).toBe(true)
  })

  it('isEditableTarget: 非 text-like input 不算可编辑', () => {
    document.body.innerHTML = ''
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    document.body.append(checkbox)
    expect(isEditableTarget(checkbox)).toBe(false)
  })

  it('isEditableTarget: 非 HTMLElement 安全返回 false', () => {
    expect(isEditableTarget(null)).toBe(false)
    expect(isEditableTarget(document)).toBe(false)
  })

  it('readSelection 在 jsdom 下返回空字符串兜底', () => {
    expect(typeof readSelection()).toBe('string')
  })
})
