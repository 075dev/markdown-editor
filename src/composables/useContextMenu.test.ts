/**
 * useContextMenu 的状态变化：单例 + show / pick / hide。
 * 不挂载组件也能直接调，确保业务逻辑可测。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useContextMenu, type MenuItemSpec } from '@/composables/useContextMenu'

describe('useContextMenu (状态机)', () => {
  beforeEach(() => {
    // 强制重新挂载
    document.body.innerHTML = ''
  })

  it('show 改变 open=true / x / y / items；hide 还原', () => {
    // 第一次调用确保单例被创建
    const m = useContextMenu() as ReturnType<typeof useContextMenu> & {
      show: (x: number, y: number, items: MenuItemSpec[]) => void
      hide: () => void
    }
    expect(m.open.value).toBe(false)

    const items: MenuItemSpec[] = [
      { key: 'a', label: '复制', onSelect: vi.fn() },
      { key: 'b', label: '粘贴', onSelect: vi.fn() },
    ]
    m.show(10, 20, items)
    expect(m.open.value).toBe(true)
    expect(m.x.value).toBe(10)
    expect(m.y.value).toBe(20)
    expect(m.items.value).toHaveLength(2)

    m.hide()
    expect(m.open.value).toBe(false)
    expect(m.items.value).toEqual([])
  })

  it('pick 触发 onSelect 并自动 hide（disabled 时不触发）', () => {
    const m = useContextMenu() as ReturnType<typeof useContextMenu> & {
      show: (x: number, y: number, items: MenuItemSpec[]) => void
      pick: (item: MenuItemSpec) => void
      hide: () => void
    }
    const cb = vi.fn()
    const item: MenuItemSpec = { key: 'a', label: '复制', onSelect: cb }
    const disabled: MenuItemSpec = { key: 'b', label: '粘贴', disabled: true, onSelect: vi.fn() }
    m.show(0, 0, [item, disabled])

    m.pick(disabled)
    expect(cb).not.toHaveBeenCalled()
    expect(m.open.value).toBe(true)

    m.pick(item)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(m.open.value).toBe(false)
  })

  it('单例：多次 useContextMenu 返回同一对象', () => {
    const m1 = useContextMenu()
    const m2 = useContextMenu()
    expect(m1.open).toBe(m2.open)
    expect(m1.items).toBe(m2.items)
  })
})
