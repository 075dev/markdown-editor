/**
 * useSyntaxCheatsheet 的状态机(add-006):
 *   - open / close / toggle 状态迁移;
 *   - openSheet 记录触发元素,closeSheet 归还焦点;
 *   - 单例:多次调用拿到同一状态对象。
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { useSyntaxCheatsheet } from '@/composables/useSyntaxCheatsheet'

describe('useSyntaxCheatsheet (状态机)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    // 复位单例状态,避免用例间串扰
    useSyntaxCheatsheet().closeSheet()
    document.body.innerHTML = ''
  })

  it('openSheet 置 open=true;closeSheet 还原', () => {
    const sheet = useSyntaxCheatsheet()
    expect(sheet.open.value).toBe(false)
    sheet.openSheet()
    expect(sheet.open.value).toBe(true)
    sheet.closeSheet()
    expect(sheet.open.value).toBe(false)
  })

  it('toggleSheet 在开/关之间往返(F1 语义)', () => {
    const sheet = useSyntaxCheatsheet()
    sheet.toggleSheet()
    expect(sheet.open.value).toBe(true)
    sheet.toggleSheet()
    expect(sheet.open.value).toBe(false)
  })

  it('openSheet 已打开时是幂等 no-op(不覆盖触发元素)', () => {
    const sheet = useSyntaxCheatsheet()
    const first = document.createElement('button')
    first.textContent = 'first'
    document.body.appendChild(first)
    first.focus()
    sheet.openSheet()
    expect(sheet.open.value).toBe(true)

    // 已打开时再次 openSheet 不应改变任何状态
    sheet.openSheet()
    expect(sheet.open.value).toBe(true)
  })

  it('closeSheet 把焦点归还给打开时的触发元素', () => {
    const sheet = useSyntaxCheatsheet()
    const trigger = document.createElement('button')
    trigger.textContent = 'trigger'
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    sheet.openSheet() // 缺省记录 document.activeElement
    expect(sheet.open.value).toBe(true)

    sheet.closeSheet()
    expect(sheet.open.value).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('closeSheet 显式传入的触发元素优先于 activeElement', () => {
    const sheet = useSyntaxCheatsheet()
    const explicit = document.createElement('button')
    explicit.textContent = 'explicit'
    document.body.appendChild(explicit)

    sheet.openSheet(explicit)
    sheet.closeSheet()
    expect(document.activeElement).toBe(explicit)
  })

  it('触发元素已离开文档时关闭不抛错、状态照常复位', () => {
    const sheet = useSyntaxCheatsheet()
    const temp = document.createElement('button')
    document.body.appendChild(temp)
    temp.focus()
    sheet.openSheet()
    temp.remove() // 模拟路由/重渲后触发元素消失
    expect(() => sheet.closeSheet()).not.toThrow()
    expect(sheet.open.value).toBe(false)
  })

  it('单例:多次 useSyntaxCheatsheet 返回同一状态对象', () => {
    const a = useSyntaxCheatsheet()
    const b = useSyntaxCheatsheet()
    expect(a.open).toBe(b.open)
    a.openSheet()
    expect(b.open.value).toBe(true)
  })
})
