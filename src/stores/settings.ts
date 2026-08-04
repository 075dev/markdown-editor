import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type Theme = 'light' | 'dark' | 'system'
export type ViewMode = 'split' | 'edit' | 'preview'

const STORAGE_KEY = 'mde:settings:v2'

interface PersistedSettings {
  theme: Theme
  splitRatio: number
  viewMode: ViewMode
}

function load(): PersistedSettings {
  if (typeof localStorage === 'undefined') {
    return { theme: 'system', splitRatio: 0.5, viewMode: 'split' }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { theme: 'system', splitRatio: 0.5, viewMode: 'split' }
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>
    return {
      theme: parsed.theme ?? 'system',
      splitRatio: typeof parsed.splitRatio === 'number' ? parsed.splitRatio : 0.5,
      viewMode: parsed.viewMode ?? 'split',
    }
  } catch {
    return { theme: 'system', splitRatio: 0.5, viewMode: 'split' }
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = load()
  const theme = ref<Theme>(initial.theme)
  const splitRatio = ref<number>(initial.splitRatio)
  const viewMode = ref<ViewMode>(initial.viewMode)

  watch(
    [theme, splitRatio, viewMode],
    ([t, r, v]) => {
      if (typeof localStorage === 'undefined') return
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ theme: t, splitRatio: r, viewMode: v }),
      )
    },
    { deep: true },
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

  return { theme, splitRatio, viewMode, toggleTheme, setViewMode, cycleViewMode }
})