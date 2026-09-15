import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

/** 六套预设主题(system 之外);新增主题时须同步扩展 global.css 的 token 块 */
export const THEMES = ['light', 'dark', 'oled', 'paper', 'bluegray', 'rose'] as const
export type ThemePreset = (typeof THEMES)[number]
export type Theme = ThemePreset | 'system'
export type ViewMode = 'split' | 'edit' | 'preview'

/** 主题显示名(设置页卡片复用) */
export const THEME_LABELS: Record<Theme, string> = {
  light: '浅色',
  dark: '深色',
  oled: '墨黑',
  paper: '纸张',
  bluegray: '蓝灰',
  rose: '玫瑰',
  system: '跟随系统',
}

export function isTheme(value: unknown): value is Theme {
  if (typeof value !== 'string') return false
  return value === 'system' || (THEMES as readonly string[]).includes(value)
}

/** 非法持久化值回落 'light';缺省(无字段)回落 'system'(跟随 OS) */
function resolveTheme(value: unknown): Theme {
  if (value === undefined || value === null || value === '') return 'system'
  return isTheme(value) ? value : 'light'
}

export const STORAGE_KEY = 'mde:settings:v6'
/** v5 → v6:读不到 v6 时尝试 v5(theme 保留合法值,其余字段透传) */
export const LEGACY_STORAGE_KEY = 'mde:settings:v5'
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
  /**
   * 双栏状态下编辑区与预览区按比例同步滚动。
   * - true：编辑器滚动 → 预览按比例跟；预览滚动 → 编辑器按比例跟
   * - false：各自独立滚动
   * 单栏（edit / preview）模式下不生效。
   */
  syncScroll: boolean
  /**
   * 自动保存总开关(ql Phase 1 填充态)。
   * 默认 false(安全默认:不改变现有手动保存行为)。
   * 开启时:内容变更 1.5 秒防抖写盘;窗口失焦立即保存全部 Dirty 标签;
   * 写盘失败按 1s/2s/4s 指数退避重试 3 次,仍失败保持 Dirty 等下次触发。
   * 关闭时:防抖/失焦/重试全部停用,仅 Ctrl+S 手动保存;冲突安全网仍生效。
   */
  autoSaveEnabled: boolean
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
      syncScroll: true,
      autoSaveEnabled: false,
    }
  }
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) {
      return {
        theme: 'system',
        splitRatio: 0.5,
        viewMode: 'split',
        sansFont: DEFAULT_SANS_FONT,
        monoFont: DEFAULT_MONO_FONT,
        fontSize: FONT_SIZE_DEFAULT,
        sidebarCollapsed: false,
        syncScroll: true,
        autoSaveEnabled: false,
      }
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      theme: resolveTheme(parsed.theme),
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
      syncScroll:
        typeof parsed.syncScroll === 'boolean' ? parsed.syncScroll : true,
      autoSaveEnabled:
        typeof parsed.autoSaveEnabled === 'boolean'
          ? parsed.autoSaveEnabled
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
      syncScroll: true,
      autoSaveEnabled: false,
    }
  }
}

export function clampFontSize(size: number): number {
  if (Number.isNaN(size)) return FONT_SIZE_DEFAULT
  return Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, Math.round(size)))
}

/**
 * 把当前主题写到 <html data-theme> 上(六预设主题 + system 移除属性)。
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

/** theme-anim 类的移除定时器(模块级,重复切换时重置) */
let themeAnimTimer: ReturnType<typeof setTimeout> | null = null

export const useSettingsStore = defineStore('settings', () => {
  const initial = load()
  const theme = ref<Theme>(initial.theme)
  const splitRatio = ref<number>(initial.splitRatio)
  const viewMode = ref<ViewMode>(initial.viewMode)
  const sansFont = ref<string>(initial.sansFont)
  const monoFont = ref<string>(initial.monoFont)
  const fontSize = ref<number>(initial.fontSize)
  const sidebarCollapsed = ref<boolean>(initial.sidebarCollapsed)
  const syncScroll = ref<boolean>(initial.syncScroll)
  const autoSaveEnabled = ref<boolean>(initial.autoSaveEnabled)

  watch(
    [theme, splitRatio, viewMode, sansFont, monoFont, fontSize, sidebarCollapsed, syncScroll, autoSaveEnabled],
    ([t, r, v, sf, mf, fs, sc, sy, as]) => {
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
            syncScroll: sy,
            autoSaveEnabled: as,
          }),
        )
      }
      applyToDocument(sf, mf, fs, t)
    },
    { deep: true, immediate: true },
  )

  /** 切换主题时短暂加 theme-anim 类(~250ms)让配色 200ms 平滑过渡;
   * 初始化路径(store 创建)不经过此函数,避免首屏闪烁。 */
  function animateThemeChange() {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.classList.add('theme-anim')
    if (themeAnimTimer !== null) clearTimeout(themeAnimTimer)
    themeAnimTimer = setTimeout(() => {
      root.classList.remove('theme-anim')
      themeAnimTimer = null
    }, 250)
  }

  function toggleTheme() {
    // 循环顺序保持既有语义(light → dark → system);其余四主题经设置页卡片选择
    const order: Theme[] = ['light', 'dark', 'system']
    const idx = order.indexOf(theme.value)
    animateThemeChange()
    theme.value = order[(idx + 1) % order.length]
  }

  function setTheme(value: Theme) {
    animateThemeChange()
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

  function setAutoSaveEnabled(value: boolean) {
    autoSaveEnabled.value = value
  }

  function toggleAutoSaveEnabled() {
    autoSaveEnabled.value = !autoSaveEnabled.value
  }

  function setSyncScroll(value: boolean) {
    syncScroll.value = value
  }

  function toggleSyncScroll() {
    syncScroll.value = !syncScroll.value
  }

  function resetAll() {
    theme.value = 'system'
    splitRatio.value = 0.5
    viewMode.value = 'split'
    sansFont.value = DEFAULT_SANS_FONT
    monoFont.value = DEFAULT_MONO_FONT
    fontSize.value = FONT_SIZE_DEFAULT
    sidebarCollapsed.value = false
    syncScroll.value = true
    autoSaveEnabled.value = false
  }

  return {
    theme,
    splitRatio,
    viewMode,
    sansFont,
    monoFont,
    fontSize,
    sidebarCollapsed,
    syncScroll,
    autoSaveEnabled,
    toggleTheme,
    setTheme,
    setViewMode,
    cycleViewMode,
    setSansFont,
    setMonoFont,
    setFontSize,
    toggleSidebar,
    setSidebarCollapsed,
    setSyncScroll,
    toggleSyncScroll,
    setAutoSaveEnabled,
    toggleAutoSaveEnabled,
    resetAll,
  }
})