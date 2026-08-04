import { describe, expect, it, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '@/stores/settings'

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
    s.resetAll()
    expect(s.theme).toBe('system')
    expect(s.viewMode).toBe('split')
    expect(s.sansFont).toBe('system-ui')
    expect(s.monoFont).toBe('ui-monospace')
    expect(s.fontSize).toBe(14)
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
    const raw = localStorage.getItem('mde:settings:v5')
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
      'mde:settings:v5',
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
    // 升级后会以 v5 key 写回（迁移后值）
    expect(localStorage.getItem('mde:settings:v5')).toContain('"Inter"')
  })
})