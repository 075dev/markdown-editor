/**
 * 正文染色主题(add-003)settings 单测:
 * 默认值 / 合法值校验 / 持久化往返 / data-content-theme 属性挂载 /
 * 非法持久化值回落 / resetAll。
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import {
  useSettingsStore,
  CONTENT_THEMES,
  CONTENT_THEME_LABELS,
  isContentTheme,
  STORAGE_KEY,
} from '@/stores/settings'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('contentTheme:默认与校验', () => {
  it('默认 follow(跟随界面主题)', () => {
    const settings = useSettingsStore()
    expect(settings.contentTheme).toBe('follow')
  })

  it('方案集与标签一一对应', () => {
    expect(CONTENT_THEMES).toEqual(['follow', 'paper', 'sepia', 'parchment', 'night'])
    for (const t of CONTENT_THEMES) {
      expect(CONTENT_THEME_LABELS[t]).toBeTruthy()
    }
  })

  it('isContentTheme 拒绝非法值', () => {
    expect(isContentTheme('sepia')).toBe(true)
    expect(isContentTheme('rainbow')).toBe(false)
    expect(isContentTheme(42)).toBe(false)
  })
})

describe('contentTheme:设置与属性挂载', () => {
  it('setContentTheme 后 html 挂 data-content-theme 并写 localStorage', async () => {
    const settings = useSettingsStore()
    settings.setContentTheme('sepia')
    await nextTick() // watch 默认 pre-flush,属性挂载在微任务后可见

    expect(settings.contentTheme).toBe('sepia')
    expect(document.documentElement.getAttribute('data-content-theme')).toBe('sepia')
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(persisted.contentTheme).toBe('sepia')
  })

  it('follow 移除 data-content-theme 属性(映射 UI 主题)', async () => {
    const settings = useSettingsStore()
    settings.setContentTheme('night')
    await nextTick()
    expect(document.documentElement.getAttribute('data-content-theme')).toBe('night')

    settings.setContentTheme('follow')
    await nextTick()
    expect(document.documentElement.hasAttribute('data-content-theme')).toBe(false)
  })

  it('非法持久化值回落 follow(不白屏)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: 'light', contentTheme: 'rainbow' }))
    const settings = useSettingsStore()
    expect(settings.contentTheme).toBe('follow')
  })

  it('resetAll 回 follow 并移除属性', async () => {
    const settings = useSettingsStore()
    settings.setContentTheme('parchment')
    await nextTick()
    settings.resetAll()
    await nextTick()

    expect(settings.contentTheme).toBe('follow')
    expect(document.documentElement.hasAttribute('data-content-theme')).toBe(false)
  })
})
