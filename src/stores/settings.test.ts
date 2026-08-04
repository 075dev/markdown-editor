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
    expect(s.sansFont).toBe('system')
    expect(s.monoFont).toBe('system')
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

  it('cycleSansFont cycles system → inter → serif → system', () => {
    const s = useSettingsStore()
    expect(s.sansFont).toBe('system')
    s.cycleSansFont()
    expect(s.sansFont).toBe('inter')
    s.cycleSansFont()
    expect(s.sansFont).toBe('serif')
    s.cycleSansFont()
    expect(s.sansFont).toBe('system')
  })

  it('cycleMonoFont cycles system → jetbrains → fira → system', () => {
    const s = useSettingsStore()
    expect(s.monoFont).toBe('system')
    s.cycleMonoFont()
    expect(s.monoFont).toBe('jetbrains')
    s.cycleMonoFont()
    expect(s.monoFont).toBe('fira')
    s.cycleMonoFont()
    expect(s.monoFont).toBe('system')
  })

  it('persists settings to localStorage', async () => {
    const s = useSettingsStore()
    s.theme = 'dark'
    s.splitRatio = 0.7
    s.viewMode = 'preview'
    s.sansFont = 'serif'
    s.monoFont = 'fira'
    await new Promise((r) => setTimeout(r, 0))
    const raw = localStorage.getItem('mde:settings:v3')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.theme).toBe('dark')
    expect(parsed.splitRatio).toBeCloseTo(0.7)
    expect(parsed.viewMode).toBe('preview')
    expect(parsed.sansFont).toBe('serif')
    expect(parsed.monoFont).toBe('fira')
  })

  it('restores settings from localStorage on next store creation', async () => {
    const s1 = useSettingsStore()
    s1.theme = 'dark'
    s1.viewMode = 'edit'
    s1.sansFont = 'serif'
    s1.monoFont = 'fira'
    await new Promise((r) => setTimeout(r, 0))

    setActivePinia(createPinia())
    const s2 = useSettingsStore()
    expect(s2.theme).toBe('dark')
    expect(s2.viewMode).toBe('edit')
    expect(s2.sansFont).toBe('serif')
    expect(s2.monoFont).toBe('fira')
  })
})