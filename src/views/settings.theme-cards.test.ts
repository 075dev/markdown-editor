import { describe, expect, it, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SettingsView from '@/views/SettingsView.vue'
import { useSettingsStore, THEMES } from '@/stores/settings'

/**
 * add-001 设置页卡片式主题选择器:
 *   - 渲染 7 张卡(六主题 + 跟随系统)
 *   - 点击卡片切换 settings store 的 theme
 *   - radio 语义:role=radio + aria-checked 反映选中态
 *   - 卡片为原生 button(Enter/Space 键盘可达由平台保证)
 */

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/services/fontService', () => ({
  listSystemFonts: vi.fn(async () => ({ sans: [], mono: [] })),
  clearFontCache: vi.fn(),
}))

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('设置页主题卡片选择器(add-001)', () => {
  it('渲染 7 张主题卡:六主题 + system,各含 data-testid', () => {
    const w = mount(SettingsView)
    const expected = [...THEMES, 'system']
    expect(expected).toHaveLength(7)
    for (const t of expected) {
      expect(w.find(`[data-testid='theme-${t}']`).exists()).toBe(true)
    }
    expect(w.findAll('.theme-card')).toHaveLength(7)
  })

  it('点击主题卡切换 store.theme 并持久化路径生效', async () => {
    const w = mount(SettingsView)
    const store = useSettingsStore()
    expect(store.theme).toBe('system')

    await w.find("[data-testid='theme-oled']").trigger('click')
    expect(store.theme).toBe('oled')
    expect(document.documentElement.getAttribute('data-theme')).toBe('oled')

    await w.find("[data-testid='theme-paper']").trigger('click')
    expect(store.theme).toBe('paper')

    await w.find("[data-testid='theme-system']").trigger('click')
    expect(store.theme).toBe('system')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('radio 语义:选中卡 aria-checked=true,其余 false', async () => {
    const w = mount(SettingsView)
    const grid = w.find('.theme-grid')
    expect(grid.attributes('role')).toBe('radiogroup')

    await w.find("[data-testid='theme-bluegray']").trigger('click')
    for (const card of w.findAll('.theme-card')) {
      const id = card.attributes('data-testid')
      expect(card.attributes('role')).toBe('radio')
      expect(card.attributes('aria-checked')).toBe(id === 'theme-bluegray' ? 'true' : 'false')
    }
  })

  it('主题卡为原生 button,键盘可达(Enter/Space 触发 click 由平台保证)', () => {
    const w = mount(SettingsView)
    for (const card of w.findAll('.theme-card')) {
      expect(card.element.tagName).toBe('BUTTON')
      expect(card.attributes('type')).toBe('button')
    }
  })

  it('选中卡有 is-active 类与勾标记,system 卡为特殊预览', async () => {
    const w = mount(SettingsView)
    await w.find("[data-testid='theme-rose']").trigger('click')
    const active = w.find("[data-testid='theme-rose']")
    expect(active.classes()).toContain('is-active')
    expect(active.find('.theme-card__check').exists()).toBe(true)

    const sysCard = w.find("[data-testid='theme-system']")
    expect(sysCard.find('.theme-card__preview--system').exists()).toBe(true)
    expect(sysCard.text()).toContain('跟随系统')
  })
})
