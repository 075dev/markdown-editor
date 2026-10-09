/**
 * 语法染色主题(add-004)settings 单测:
 * 默认值 / 方案集校验 / 持久化往返 / data-syntax-theme 属性挂载 /
 * 非法持久化值回落 / resetAll。模式与 settings.content-theme.test.ts 同构。
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import {
  useSettingsStore,
  SYNTAX_THEMES,
  SYNTAX_THEME_LABELS,
  isSyntaxTheme,
  STORAGE_KEY,
} from '@/stores/settings'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('syntaxTheme:默认与校验', () => {
  it('默认 follow(跟随内容配色)', () => {
    const settings = useSettingsStore()
    expect(settings.syntaxTheme).toBe('follow')
  })

  it('方案集与标签一一对应', () => {
    expect(SYNTAX_THEMES).toEqual(['follow', 'rainbow', 'academic', 'mono'])
    for (const t of SYNTAX_THEMES) {
      expect(SYNTAX_THEME_LABELS[t]).toBeTruthy()
    }
  })

  it('isSyntaxTheme 拒绝非法值', () => {
    expect(isSyntaxTheme('rainbow')).toBe(true)
    expect(isSyntaxTheme('neon')).toBe(false)
    expect(isSyntaxTheme(null)).toBe(false)
  })
})

describe('syntaxTheme:设置与属性挂载', () => {
  it('setSyntaxTheme 后 html 挂 data-syntax-theme 并写 localStorage', async () => {
    const settings = useSettingsStore()
    settings.setSyntaxTheme('rainbow')
    await nextTick() // watch 默认 pre-flush

    expect(settings.syntaxTheme).toBe('rainbow')
    expect(document.documentElement.getAttribute('data-syntax-theme')).toBe('rainbow')
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(persisted.syntaxTheme).toBe('rainbow')
  })

  it('follow 移除 data-syntax-theme 属性(映射内容配色)', async () => {
    const settings = useSettingsStore()
    settings.setSyntaxTheme('academic')
    await nextTick()
    expect(document.documentElement.getAttribute('data-syntax-theme')).toBe('academic')

    settings.setSyntaxTheme('follow')
    await nextTick()
    expect(document.documentElement.hasAttribute('data-syntax-theme')).toBe(false)
  })

  it('与 contentTheme/data-content-theme 互不干扰(三层正交)', async () => {
    const settings = useSettingsStore()
    settings.setContentTheme('sepia')
    settings.setSyntaxTheme('mono')
    await nextTick()

    expect(document.documentElement.getAttribute('data-content-theme')).toBe('sepia')
    expect(document.documentElement.getAttribute('data-syntax-theme')).toBe('mono')
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(persisted.contentTheme).toBe('sepia')
    expect(persisted.syntaxTheme).toBe('mono')
  })

  it('非法持久化值回落 follow', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ theme: 'light', contentTheme: 'follow', syntaxTheme: 'neon' }),
    )
    const settings = useSettingsStore()
    expect(settings.syntaxTheme).toBe('follow')
  })

  it('resetAll 回 follow 并移除属性', async () => {
    const settings = useSettingsStore()
    settings.setSyntaxTheme('mono')
    await nextTick()
    settings.resetAll()
    await nextTick()

    expect(settings.syntaxTheme).toBe('follow')
    expect(document.documentElement.hasAttribute('data-syntax-theme')).toBe(false)
  })
})
