import { describe, expect, it, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  useSettingsStore,
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  THEMES,
  THEME_LABELS,
  isTheme,
} from '@/stores/settings'

beforeEach(() => {
  // 清空 localStorage 防止污染（jsdom 下 clear 可能不存在，逐项删除兜底）
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.clear()
    } catch {
      try {
        Object.keys(localStorage).forEach((k) => localStorage.removeItem(k))
      } catch {
        /* ignore */
      }
    }
  }
  setActivePinia(createPinia())
})

describe('settings store', () => {
  it('starts with sensible defaults', () => {
    const s = useSettingsStore()
    expect(s.theme).toBe('system')
    expect(s.splitRatio).toBeCloseTo(0.5)
    expect(s.viewMode).toBe('split')
    expect(s.sansFont).toBe('system-ui')
    expect(s.monoFont).toBe('ui-monospace')
    expect(s.sidebarCollapsed).toBe(false)
  })

  it('toggleTheme cycles light → dark → system → light', () => {
    const s = useSettingsStore()
    s.theme = 'light'
    s.toggleTheme()
    expect(s.theme).toBe('dark')
    s.toggleTheme()
    expect(s.theme).toBe('system')
    s.toggleTheme()
    expect(s.theme).toBe('light')
  })

  it('setViewMode updates viewMode', () => {
    const s = useSettingsStore()
    s.setViewMode('edit')
    expect(s.viewMode).toBe('edit')
    s.setViewMode('preview')
    expect(s.viewMode).toBe('preview')
  })

  it('cycleViewMode cycles split → edit → preview → split', () => {
    const s = useSettingsStore()
    expect(s.viewMode).toBe('split')
    s.cycleViewMode()
    expect(s.viewMode).toBe('edit')
    s.cycleViewMode()
    expect(s.viewMode).toBe('preview')
    s.cycleViewMode()
    expect(s.viewMode).toBe('split')
  })

  it('setSansFont / setMonoFont set values directly', () => {
    const s = useSettingsStore()
    s.setSansFont('Helvetica Neue')
    expect(s.sansFont).toBe('Helvetica Neue')
    s.setMonoFont('Cascadia Code')
    expect(s.monoFont).toBe('Cascadia Code')
    // 空字符串 / 空白被忽略，保留旧值
    s.setSansFont('   ')
    expect(s.sansFont).toBe('Helvetica Neue')
  })

  it('fontSize defaults to 14 and clamps to [10, 24]', () => {
    const s = useSettingsStore()
    expect(s.fontSize).toBe(14)
    s.setFontSize(50)
    expect(s.fontSize).toBe(24)
    s.setFontSize(2)
    expect(s.fontSize).toBe(10)
    s.setFontSize(16.4) // 不接受小数，向上取整到 16
    expect(s.fontSize).toBe(16)
    s.setFontSize(Number.NaN)
    expect(s.fontSize).toBe(14)
  })

  it('setTheme / setSansFont / setMonoFont update directly', () => {
    const s = useSettingsStore()
    s.setTheme('dark')
    expect(s.theme).toBe('dark')
    s.setSansFont('Inter')
    expect(s.sansFont).toBe('Inter')
    s.setMonoFont('JetBrains Mono')
    expect(s.monoFont).toBe('JetBrains Mono')
  })

  it('resetAll restores defaults', () => {
    const s = useSettingsStore()
    s.theme = 'dark'
    s.viewMode = 'preview'
    s.sansFont = 'Avenir'
    s.monoFont = 'Cascadia Code'
    s.fontSize = 20
    s.sidebarCollapsed = true
    s.resetAll()
    expect(s.theme).toBe('system')
    expect(s.viewMode).toBe('split')
    expect(s.sansFont).toBe('system-ui')
    expect(s.monoFont).toBe('ui-monospace')
    expect(s.fontSize).toBe(14)
    expect(s.sidebarCollapsed).toBe(false)
  })

  it('sidebarCollapsed starts false and toggles correctly', () => {
    const s = useSettingsStore()
    expect(s.sidebarCollapsed).toBe(false)
    s.toggleSidebar()
    expect(s.sidebarCollapsed).toBe(true)
    s.toggleSidebar()
    expect(s.sidebarCollapsed).toBe(false)
  })

  it('setSidebarCollapsed sets value directly', () => {
    const s = useSettingsStore()
    s.setSidebarCollapsed(true)
    expect(s.sidebarCollapsed).toBe(true)
    s.setSidebarCollapsed(false)
    expect(s.sidebarCollapsed).toBe(false)
  })

  it('setTheme writes data-theme to <html> and removes it for system', async () => {
    const s = useSettingsStore()
    await new Promise((r) => setTimeout(r, 0))
    s.setTheme('light')
    await new Promise((r) => setTimeout(r, 10))
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    s.setTheme('dark')
    await new Promise((r) => setTimeout(r, 10))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    s.setTheme('system')
    await new Promise((r) => setTimeout(r, 10))
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('persists settings to localStorage', async () => {
    const s = useSettingsStore()
    s.theme = 'dark'
    s.splitRatio = 0.7
    s.viewMode = 'preview'
    s.sansFont = 'Helvetica Neue'
    s.monoFont = 'Cascadia Code'
    s.fontSize = 18
    await new Promise((r) => setTimeout(r, 0))
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.theme).toBe('dark')
    expect(parsed.splitRatio).toBeCloseTo(0.7)
    expect(parsed.viewMode).toBe('preview')
    expect(parsed.sansFont).toBe('Helvetica Neue')
    expect(parsed.monoFont).toBe('Cascadia Code')
    expect(parsed.fontSize).toBe(18)
  })

  it('restores settings from localStorage on next store creation', async () => {
    const s1 = useSettingsStore()
    s1.theme = 'dark'
    s1.viewMode = 'edit'
    s1.sansFont = 'Avenir Next'
    s1.monoFont = 'Cascadia Code'
    s1.fontSize = 20
    await new Promise((r) => setTimeout(r, 0))

    setActivePinia(createPinia())
    const s2 = useSettingsStore()
    expect(s2.theme).toBe('dark')
    expect(s2.viewMode).toBe('edit')
    expect(s2.sansFont).toBe('Avenir Next')
    expect(s2.monoFont).toBe('Cascadia Code')
    expect(s2.fontSize).toBe(20)
  })

  it('migrates legacy enum values when reading old storage', () => {
    // 模拟 v3/v4 写入的旧枚举
    localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        theme: 'dark',
        splitRatio: 0.5,
        viewMode: 'split',
        sansFont: 'inter', // legacy
        monoFont: 'jetbrains', // legacy
        fontSize: 16,
      }),
    )
    setActivePinia(createPinia())
    const s = useSettingsStore()
    expect(s.sansFont).toBe('Inter')
    expect(s.monoFont).toBe('JetBrains Mono')
    // 迁移后会以新 key(v6)写回(迁移后值)
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"Inter"')
  })
})
describe('add-001 六主题体系', () => {
  it('六主题 setTheme 往返:store 值 + data-theme 属性同步', async () => {
    const s = useSettingsStore()
    for (const t of THEMES) {
      s.setTheme(t)
      await new Promise((r) => setTimeout(r, 10))
      expect(s.theme).toBe(t)
      expect(document.documentElement.getAttribute('data-theme')).toBe(t)
    }
    s.setTheme('system')
    await new Promise((r) => setTimeout(r, 10))
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('切换主题时加 theme-anim 临时类,约 250ms 后移除', () => {
    vi.useFakeTimers()
    try {
      const s = useSettingsStore()
      s.setTheme('oled')
      expect(document.documentElement.classList.contains('theme-anim')).toBe(true)
      vi.advanceTimersByTime(260)
      expect(document.documentElement.classList.contains('theme-anim')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('setTheme 持久化到 v6', async () => {
    const s = useSettingsStore()
    s.setTheme('rose')
    await new Promise((r) => setTimeout(r, 0))
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!).theme).toBe('rose')
  })

  it('v5 旧数据迁移:theme 保留合法值,其余字段透传,并写回 v6', async () => {
    localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({ theme: 'paper', splitRatio: 0.4, viewMode: 'edit' }),
    )
    const s = useSettingsStore()
    expect(s.theme).toBe('paper')
    expect(s.splitRatio).toBeCloseTo(0.4)
    expect(s.viewMode).toBe('edit')
    await new Promise((r) => setTimeout(r, 0))
    const v6 = localStorage.getItem(STORAGE_KEY)
    expect(v6).toBeTruthy()
    expect(JSON.parse(v6!).theme).toBe('paper')
  })

  it('非法 theme 值回落 light(v5 与 v6 皆然)', () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ theme: 'banana' }))
    expect(useSettingsStore().theme).toBe('light')

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: 42 }))
    setActivePinia(createPinia())
    expect(useSettingsStore().theme).toBe('light')
  })

  it('v6 优先于 v5(迁移不回退)', () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ theme: 'dark' }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: 'oled' }))
    expect(useSettingsStore().theme).toBe('oled')
  })

  it('isTheme / THEME_LABELS 覆盖七值', () => {
    expect(isTheme('oled')).toBe(true)
    expect(isTheme('nope')).toBe(false)
    expect(isTheme(42)).toBe(false)
    const all = [...THEMES, 'system'] as const
    for (const t of all) {
      expect(THEME_LABELS[t]).toBeTruthy()
      expect(isTheme(t)).toBe(true)
    }
  })
})
