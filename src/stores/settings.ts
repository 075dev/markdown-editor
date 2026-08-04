import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type Theme = 'light' | 'dark' | 'system'
export type ViewMode = 'split' | 'edit' | 'preview'

const STORAGE_KEY = 'mde:settings:v5'
export const FONT_SIZE_MIN = 10
export const FONT_SIZE_MAX = 24
export const FONT_SIZE_DEFAULT = 14

/**
 * 字体现在存为字符串：用户从系统字体列表里挑或自定义输入。
 * `DEFAULT_SANS_FONT` / `DEFAULT_MONO_FONT` 是首次启动时的 fallback。
 */
export const DEFAULT_SANS_FONT = 'system-ui'
export const DEFAULT_MONO_FONT = 'ui-monospace'

interface PersistedSettings {
  theme: Theme
  splitRatio: number
  viewMode: ViewMode
  sansFont: string
  monoFont: string
  fontSize: number
  sidebarCollapsed: boolean
}

/**
 * 旧版（v3/v4）使用枚举值。新版读到旧值时按下面映射表迁移：
 *   - 'system'  -> 'system-ui' (sans) / 'ui-monospace' (mono)
 *   - 'inter'   -> 'Inter'
 *   - 'serif'   -> 'serif'
 *   - 'jetbrains' -> 'JetBrains Mono'
 *   - 'fira'    -> 'Fira Code'
 * 不在表里的旧值保持原样（用户再选一次）。
 */
const LEGACY_SANS_MAP: Record<string, string> = {
  system: 'system-ui',
  inter: 'Inter',
  serif: 'serif',
}

const LEGACY_MONO_MAP: Record<string, string> = {
  system: 'ui-monospace',
  jetbrains: 'JetBrains Mono',
  fira: 'Fira Code',
}

function migrateSansFont(value: unknown): string {
  if (typeof value !== 'string' || !value) return DEFAULT_SANS_FONT
  return LEGACY_SANS_MAP[value] ?? value
}

function migrateMonoFont(value: unknown): string {
  if (typeof value !== 'string' || !value) return DEFAULT_MONO_FONT
  return LEGACY_MONO_MAP[value] ?? value
}

/**
 * 浏览器内置 fallback 字体列表（在 jsdom / Web 模式下用作下拉选项）。
 * 这些字体名按概率从高到低排序，方便用户快速找到已安装的字体。
 */
export const WEB_FALLBACK_FONTS: { sans: string[]; mono: string[] } = {
  sans: [
    'system-ui', // 浏览器默认 sans 栈
    'Segoe UI', // Windows
    'San Francisco',
    'SF Pro Text',
    'Helvetica Neue',
    'Arial',
    'Liberation Sans',
    'DejaVu Sans',
    'Roboto', // Android / Chrome OS
    'Cantarell', // GNOME
    'Ubuntu', // Ubuntu
    'Noto Sans',
    'PingFang SC', // macOS 中文
    'Microsoft YaHei', // Windows 中文
    'Source Han Sans CN', // 思源黑体
    'Inter',
    'Helvetica',
  ],
  mono: [
    'ui-monospace',
    'Menlo', // macOS 默认
    'Consolas', // Windows
    'Cascadia Code',
    'Cascadia Mono',
    'Liberation Mono',
    'DejaVu Sans Mono',
    'Ubuntu Mono',
    'Monaco',
    'Courier New',
    'Source Code Pro',
    'Fira Code',
    'JetBrains Mono',
    'IBM Plex Mono',
    'Sarasa Mono SC', // 中文等宽
  ],
}

/** 把任意用户输入的字体名包装成安全的 CSS font-family 字符串（带 fallback） */
export function toFontStack(family: string, kind: 'sans' | 'mono'): string {
  const trimmed = family.trim()
  if (!trimmed) return kind === 'sans' ? DEFAULT_SANS_FONT : DEFAULT_MONO_FONT
  // 用户输入的字体名如果包含空格或特殊字符，加引号
  const quoted = /[\s"']/.test(trimmed) ? `"${trimmed.replace(/"/g, '\\"')}"` : trimmed
  const fallback =
    kind === 'sans'
      ? "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
      : "ui-monospace, Menlo, Consolas, 'Courier New', monospace"
  return `${quoted}, ${fallback}`
}

function load(): PersistedSettings {
  if (typeof localStorage === 'undefined') {
    return {
      theme: 'system',
      splitRatio: 0.5,
      viewMode: 'split',
      sansFont: DEFAULT_SANS_FONT,
      monoFont: DEFAULT_MONO_FONT,
      fontSize: FONT_SIZE_DEFAULT,
      sidebarCollapsed: false,
    }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {
        theme: 'system',
        splitRatio: 0.5,
        viewMode: 'split',
        sansFont: DEFAULT_SANS_FONT,
        monoFont: DEFAULT_MONO_FONT,
        fontSize: FONT_SIZE_DEFAULT,
        sidebarCollapsed: false,
      }
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      theme: (parsed.theme as Theme) ?? 'system',
      splitRatio:
        typeof parsed.splitRatio === 'number' ? parsed.splitRatio : 0.5,
      viewMode: (parsed.viewMode as ViewMode) ?? 'split',
      sansFont: migrateSansFont(parsed.sansFont),
      monoFont: migrateMonoFont(parsed.monoFont),
      fontSize:
        typeof parsed.fontSize === 'number'
          ? clampFontSize(parsed.fontSize)
          : FONT_SIZE_DEFAULT,
      sidebarCollapsed:
        typeof parsed.sidebarCollapsed === 'boolean'
          ? parsed.sidebarCollapsed
          : false,
    }
  } catch {
    return {
      theme: 'system',
      splitRatio: 0.5,
      viewMode: 'split',
      sansFont: DEFAULT_SANS_FONT,
      monoFont: DEFAULT_MONO_FONT,
      fontSize: FONT_SIZE_DEFAULT,
      sidebarCollapsed: false,
    }
  }
}

export function clampFontSize(size: number): number {
  if (Number.isNaN(size)) return FONT_SIZE_DEFAULT
  return Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, Math.round(size)))
}

/**
 * 把当前主题写到 <html data-theme="light|dark"> 上。
 * CSS 用 [data-theme=...] 选择器覆盖 `:root` 默认变量。
 * theme === 'system' 时只移除属性，让浏览器跟随 OS。
 */
function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (!root) return
  if (theme === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', theme)
  }
}

function applyToDocument(
  sansFont: string,
  monoFont: string,
  fontSize: number,
  theme: Theme,
) {
  applyTheme(theme)
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (!root) return
  const sansStack = toFontStack(sansFont, 'sans')
  const monoStack = toFontStack(monoFont, 'mono')
  root.style.setProperty('--font-sans', sansStack)
  root.style.setProperty('--font-mono', monoStack)
  root.style.setProperty('--font-size-base', `${fontSize}px`)

  // 兜底：把 font-family 直接写到 <body> 的 inline style。
  // 某些 Vue scoped CSS + CSS 变量的组合下，组件内 `var(--font-sans)`
  // 可能在某些 WebView 渲染进程里不解析；inline style on body 是最高优先级
  // 且不受 Vue scoped CSS 重写影响，能 100% 生效。
  if (document.body) {
    document.body.style.fontFamily = sansStack
    document.body.style.fontSize = `${fontSize}px`
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = load()
  const theme = ref<Theme>(initial.theme)
  const splitRatio = ref<number>(initial.splitRatio)
  const viewMode = ref<ViewMode>(initial.viewMode)
  const sansFont = ref<string>(initial.sansFont)
  const monoFont = ref<string>(initial.monoFont)
  const fontSize = ref<number>(initial.fontSize)
  const sidebarCollapsed = ref<boolean>(initial.sidebarCollapsed)

  watch(
    [theme, splitRatio, viewMode, sansFont, monoFont, fontSize, sidebarCollapsed],
    ([t, r, v, sf, mf, fs, sc]) => {
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
            sidebarCollapsed: sc,
          }),
        )
      }
      applyToDocument(sf, mf, fs, t)
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

  function setSansFont(value: string) {
    const trimmed = value.trim()
    // 空输入：保持当前值不变，让用户重新输入
    if (!trimmed) return
    sansFont.value = trimmed
  }

  function setMonoFont(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    monoFont.value = trimmed
  }

  function setFontSize(value: number) {
    fontSize.value = clampFontSize(value)
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function setSidebarCollapsed(value: boolean) {
    sidebarCollapsed.value = value
  }

  function resetAll() {
    theme.value = 'system'
    splitRatio.value = 0.5
    viewMode.value = 'split'
    sansFont.value = DEFAULT_SANS_FONT
    monoFont.value = DEFAULT_MONO_FONT
    fontSize.value = FONT_SIZE_DEFAULT
    sidebarCollapsed.value = false
  }

  return {
    theme,
    splitRatio,
    viewMode,
    sansFont,
    monoFont,
    fontSize,
    sidebarCollapsed,
    toggleTheme,
    setTheme,
    setViewMode,
    cycleViewMode,
    setSansFont,
    setMonoFont,
    setFontSize,
    toggleSidebar,
    setSidebarCollapsed,
    resetAll,
  }
})