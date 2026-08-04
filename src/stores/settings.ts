import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'mde:settings:v1'

interface PersistedSettings {
  theme: Theme
  splitRatio: number
}

function load(): PersistedSettings {
  if (typeof localStorage === 'undefined') return { theme: 'system', splitRatio: 0.5 }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { theme: 'system', splitRatio: 0.5 }
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>
    return {
      theme: parsed.theme ?? 'system',
      splitRatio: typeof parsed.splitRatio === 'number' ? parsed.splitRatio : 0.5,
    }
  } catch {
    return { theme: 'system', splitRatio: 0.5 }
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = load()
  const theme = ref<Theme>(initial.theme)
  const splitRatio = ref<number>(initial.splitRatio)

  watch(
    [theme, splitRatio],
    ([t, r]) => {
      if (typeof localStorage === 'undefined') return
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: t, splitRatio: r }))
    },
    { deep: true },
  )

  function toggleTheme() {
    const order: Theme[] = ['light', 'dark', 'system']
    const idx = order.indexOf(theme.value)
    theme.value = order[(idx + 1) % order.length]
  }

  return { theme, splitRatio, toggleTheme }
})