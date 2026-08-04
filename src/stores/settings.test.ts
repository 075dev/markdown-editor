import { describe, expect, it, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '@/stores/settings'

beforeEach(() => {
  // 清空 localStorage 防止污染（jsdom 下 clear 可能不存在，逐项删除兜底）
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.clear()
    } catch {
      // jsdom 下 localStorage 可能未完全实现
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

  it('persists settings to localStorage', async () => {
    const s = useSettingsStore()
    s.theme = 'dark'
    s.splitRatio = 0.7
    s.viewMode = 'preview'
    // watch 是异步的，等下一帧
    await new Promise((r) => setTimeout(r, 0))
    const raw = localStorage.getItem('mde:settings:v2')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.theme).toBe('dark')
    expect(parsed.splitRatio).toBeCloseTo(0.7)
    expect(parsed.viewMode).toBe('preview')
  })

  it('restores settings from localStorage on next store creation', async () => {
    const s1 = useSettingsStore()
    s1.theme = 'dark'
    s1.viewMode = 'edit'
    await new Promise((r) => setTimeout(r, 0))

    // 重建 pinia + store 实例，模拟下次启动
    setActivePinia(createPinia())
    const s2 = useSettingsStore()
    expect(s2.theme).toBe('dark')
    expect(s2.viewMode).toBe('edit')
  })
})