import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type Theme = 'light' | 'dark' | 'system'
export type ViewMode = 'split' | 'edit' | 'preview'
export type SansFont = 'system' | 'inter' | 'serif'
export type MonoFont = 'system' | 'jetbrains' | 'fira'

const STORAGE_KEY = 'mde:settings:v3'

interface PersistedSettings {
  theme: Theme
  splitRatio: number
  viewMode: ViewMode
  sansFont: SansFont
  monoFont: MonoFont
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

function load(): PersistedSettings {
  if (typeof localStorage === 'undefined') {
    return {
      theme: 'system',
      splitRatio: 0.5,
      viewMode: 'split',
      sansFont: 'system',
      monoFont: 'system',
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
      }
    }
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>
    return {
      theme: parsed.theme ?? 'system',
      splitRatio: typeof parsed.splitRatio === 'number' ? parsed.splitRatio : 0.5,
      viewMode: parsed.viewMode ?? 'split',
      sansFont: parsed.sansFont ?? 'system',
      monoFont: parsed.monoFont ?? 'system',
    }
  } catch {
    return {
      theme: 'system',
      splitRatio: 0.5,
      viewMode: 'split',
      sansFont: 'system',
      monoFont: 'system',
    }
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = load()
  const theme = ref<Theme>(initial.theme)
  const splitRatio = ref<number>(initial.splitRatio)
  const viewMode = ref<ViewMode>(initial.viewMode)
  const sansFont = ref<SansFont>(initial.sansFont)
  const monoFont = ref<MonoFont>(initial.monoFont)

  watch(
    [theme, splitRatio, viewMode, sansFont, monoFont],
    ([t, r, v, sf, mf]) => {
      if (typeof localStorage === 'undefined') return
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ theme: t, splitRatio: r, viewMode: v, sansFont: sf, monoFont: mf }),
      )
      // 同步把 CSS 变量写到 <html> 上，让全局字体立即生效
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--font-sans', SANS_FONT_STACKS[sf])
        document.documentElement.style.setProperty('--font-mono', MONO_FONT_STACKS[mf])
      }
    },
    { deep: true, immediate: true },
  )

  function toggleTheme() {
    const order: Theme[] = ['light', 'dark', 'system']
    const idx = order.indexOf(theme.value)
    theme.value = order[(idx + 1) % order.length]
  }

  function setViewMode(mode: ViewMode) {
    viewMode.value = mode
  }

  function cycleViewMode() {
    const order: ViewMode[] = ['split', 'edit', 'preview']
    const idx = order.indexOf(viewMode.value)
    viewMode.value = order[(idx + 1) % order.length]
  }

  function cycleSansFont() {
    const order: SansFont[] = ['system', 'inter', 'serif']
    const idx = order.indexOf(sansFont.value)
    sansFont.value = order[(idx + 1) % order.length]
  }

  function cycleMonoFont() {
    const order: MonoFont[] = ['system', 'jetbrains', 'fira']
    const idx = order.indexOf(monoFont.value)
    monoFont.value = order[(idx + 1) % order.length]
  }

  return {
    theme,
    splitRatio,
    viewMode,
    sansFont,
    monoFont,
    toggleTheme,
    setViewMode,
    cycleViewMode,
    cycleSansFont,
    cycleMonoFont,
  }
})