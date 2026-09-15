import { describe, expect, it, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore, STORAGE_KEY } from '@/stores/settings'

/**
 * 自动保存设置字段(ql Phase 1 骨架):
 *   - autoSaveEnabled 默认 false(骨架期安全默认)
 *   - setAutoSaveEnabled / toggleAutoSaveEnabled
 *   - 纳入既有 localStorage 持久化机制(往返)
 */

beforeEach(() => {
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

describe('settings.autoSaveEnabled', () => {
  it('defaults to false (skeleton-safe default)', () => {
    const s = useSettingsStore()
    expect(s.autoSaveEnabled).toBe(false)
  })

  it('setAutoSaveEnabled sets the value directly', () => {
    const s = useSettingsStore()
    s.setAutoSaveEnabled(true)
    expect(s.autoSaveEnabled).toBe(true)
    s.setAutoSaveEnabled(false)
    expect(s.autoSaveEnabled).toBe(false)
  })

  it('toggleAutoSaveEnabled flips the value', () => {
    const s = useSettingsStore()
    expect(s.autoSaveEnabled).toBe(false)
    s.toggleAutoSaveEnabled()
    expect(s.autoSaveEnabled).toBe(true)
    s.toggleAutoSaveEnabled()
    expect(s.autoSaveEnabled).toBe(false)
  })

  it('persists autoSaveEnabled to localStorage', async () => {
    const s = useSettingsStore()
    s.setAutoSaveEnabled(true)
    await new Promise((r) => setTimeout(r, 0))
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.autoSaveEnabled).toBe(true)
  })

  it('restores autoSaveEnabled from localStorage on next store creation', async () => {
    const s1 = useSettingsStore()
    s1.setAutoSaveEnabled(true)
    await new Promise((r) => setTimeout(r, 0))

    setActivePinia(createPinia())
    const s2 = useSettingsStore()
    expect(s2.autoSaveEnabled).toBe(true)
  })

  it('resetAll restores autoSaveEnabled to false', () => {
    const s = useSettingsStore()
    s.setAutoSaveEnabled(true)
    s.resetAll()
    expect(s.autoSaveEnabled).toBe(false)
  })

  it('legacy storage without autoSaveEnabled falls back to false', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ theme: 'dark', splitRatio: 0.5, viewMode: 'split' }),
    )
    setActivePinia(createPinia())
    const s = useSettingsStore()
    expect(s.autoSaveEnabled).toBe(false)
  })
})

describe('settings.autoSaveEnabled(填充阶段补充:持久化路径全覆盖)', () => {
  it('toggleAutoSaveEnabled 切换值也写回 localStorage', async () => {
    const s = useSettingsStore()
    s.toggleAutoSaveEnabled()
    await new Promise((r) => setTimeout(r, 0))
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(parsed.autoSaveEnabled).toBe(true)
  })

  it('resetAll 恢复 false 且写回 localStorage(重置路径不残留 true)', async () => {
    const s = useSettingsStore()
    s.setAutoSaveEnabled(true)
    await new Promise((r) => setTimeout(r, 0))
    s.resetAll()
    await new Promise((r) => setTimeout(r, 0))
    expect(s.autoSaveEnabled).toBe(false)
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(parsed.autoSaveEnabled).toBe(false)
  })
})
