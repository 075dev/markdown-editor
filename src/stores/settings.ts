import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type Theme = 'light' | 'dark' | 'system'
export type ViewMode = 'split' | 'edit' | 'preview'
export type SansFont = 'system' | 'inter' | 'serif'
export type MonoFont = 'system' | 'jetbrains' | 'fira'

const STORAGE_KEY = 'mde:settings:v4'
export const FONT_SIZE_MIN = 10
export const FONT_SIZE_MAX = 24
export const FONT_SIZE_DEFAULT = 14

interface PersistedSettings {
  theme: Theme
  splitRatio: number
  viewMode: ViewMode
  sansFont: SansFont
  monoFont: MonoFont
  fontSize: number
}

/**
 * 字体预设的 CSS font-family 栈。
 * 第一个是字体名；后面的回退栈确保即使字体未安装也有合理渲染。
 */
export const SANS_FONT_STACKS: Record<SansFont, string> = {
  system:
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  inter: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  serif: "'Iowan Old Style', 'Apple Garamond', Baskerville, 'Times New Roman', 'Droid Serif', Times, 'Source Serif Pro', serif",
}

export const MONO_FONT_STACKS: Record<MonoFont, string> = {
  system:
    "ui-monospace, 'Cascadia Code', 'Cascadia Mono', Menlo, Consolas, 'Courier New', monospace",
  jetbrains:
    "'JetBrains Mono', 'Cascadia Code', 'Cascadia Mono', Menlo, Consolas, monospace",
  fira: "'Fira Code', 'JetBrains Mono', 'Cascadia Code', Menlo, Consolas, monospace",
}

/** UI 显示标签 */
export const SANS_FONT_LABELS: Record<SansFont, string> = {
  system: '系统',
  inter: 'Inter',
  serif: '衬线',
}

export const MONO_FONT_LABELS: Record<MonoFont, string> = {
  system: '系统',
  jetbrains: 'JetBrains',
  fira: 'Fira Code',
}

export function clampFontSize(size: number): number {
  if (Number.isNaN(size)) return FONT_SIZE_DEFAULT
  return Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, Math.round(size)))
}

function load(): PersistedSettings {
  if (typeof localStorage === 'undefined') {
    return {
      theme: 'system',
      splitRatio: 0.5,
      viewMode: 'split',
      sansFont: 'system',
      monoFont: 'system',
      fontSize: FONT_SIZE_DEFAULT,
    }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {
        theme: 'system',
        splitRatio: 0.5,
        viewMode: 'split',
        sansFont: 'system',
        monoFont: 'system',
        fontSize: FONT_SIZE_DEFAULT,
      }
    }
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>
    return {
      theme: parsed.theme ?? 'system',
      splitRatio: typeof parsed.splitRatio === 'number' ? parsed.splitRatio : 0.5,
      viewMode: parsed.viewMode ?? 'split',
      sansFont: parsed.sansFont ?? 'system',
      monoFont: parsed.monoFont ?? 'system',
      fontSize:
        typeof parsed.fontSize === 'number'
          ? clampFontSize(parsed.fontSize)
          : FONT_SIZE_DEFAULT,
    }
  } catch {
    return {
      theme: 'system',
      splitRatio: 0.5,
      viewMode: 'split',
      sansFont: 'system',
      monoFont: 'system',
      fontSize: FONT_SIZE_DEFAULT,
    }
  }
}

/**
 * 把 fontSize / fontFamily 同步到 <html> 的 CSS 变量上，让全局 UI 立即生效。
 * 调用方负责传入 document 对象；测试环境可能没有 document，需要判断。
 */
function applyToDocument(
  sansFont: SansFont,
  monoFont: MonoFont,
  fontSize: number,
) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (!root) return
  root.style.setProperty('--font-sans', SANS_FONT_STACKS[sansFont])
  root.style.setProperty('--font-mono', MONO_FONT_STACKS[monoFont])
  root.style.setProperty('--font-size-base', `${fontSize}px`)
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = load()
  const theme = ref<Theme>(initial.theme)
  const splitRatio = ref<number>(initial.splitRatio)
  const viewMode = ref<ViewMode>(initial.viewMode)
  const sansFont = ref<SansFont>(initial.sansFont)
  const monoFont = ref<MonoFont>(initial.monoFont)
  const fontSize = ref<number>(initial.fontSize)

  watch(
    [theme, splitRatio, viewMode, sansFont, monoFont, fontSize],
    ([t, r, v, sf, mf, fs]) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            theme: t,
            splitRatio: r,
            viewMode: v,
            sansFont: sf,
            monoFont: mf,
            fontSize: fs,
          }),
        )
      }
      applyToDocument(sf, mf, fs)
    },
    { deep: true, immediate: true },
  )

  function toggleTheme() {
    const order: Theme[] = ['light', 'dark', 'system']
    const idx = order.indexOf(theme.value)
    theme.value = order[(idx + 1) % order.length]
  }

  function setTheme(value: Theme) {
    theme.value = value
  }

  function setViewMode(mode: ViewMode) {
    viewMode.value = mode
  }

  function cycleViewMode() {
    const order: ViewMode[] = ['split', 'edit', 'preview']
    const idx = order.indexOf(viewMode.value)
    viewMode.value = order[(idx + 1) % order.length]
  }

  function setSansFont(value: SansFont) {
    sansFont.value = value
  }

  function setMonoFont(value: MonoFont) {
    monoFont.value = value
  }

  function setFontSize(value: number) {
    fontSize.value = clampFontSize(value)
  }

  function resetAll() {
    theme.value = 'system'
    splitRatio.value = 0.5
    viewMode.value = 'split'
    sansFont.value = 'system'
    monoFont.value = 'system'
    fontSize.value = FONT_SIZE_DEFAULT
  }

  return {
    theme,
    splitRatio,
    viewMode,
    sansFont,
    monoFont,
    fontSize,
    toggleTheme,
    setTheme,
    setViewMode,
    cycleViewMode,
    setSansFont,
    setMonoFont,
    setFontSize,
    resetAll,
  }
})