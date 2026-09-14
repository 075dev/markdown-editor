<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import {
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_DEFAULT,
  type Theme,
  type ViewMode,
} from '@/stores/settings'
import { listSystemFonts, clearFontCache, type FontList } from '@/services/fontService'

const router = useRouter()
const settings = useSettingsStore()

const fontList = ref<FontList>({ sans: [], mono: [] })
const loading = ref(true)
const refreshError = ref<string | null>(null)
const customSansInput = ref('')
const customMonoInput = ref('')
const customSansOpen = ref(false)
const customMonoOpen = ref(false)

const themes: Array<{ value: Theme; label: string }> = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
]

const viewModes: Array<{ value: ViewMode; label: string; hint: string }> = [
  { value: 'edit', label: '纯编辑', hint: '只显示编辑器' },
  { value: 'split', label: '双栏', hint: '编辑器 + 预览' },
  { value: 'preview', label: '纯预览', hint: '只显示预览' },
]

async function refreshFonts() {
  loading.value = true
  refreshError.value = null
  try {
    fontList.value = await listSystemFonts()
  } catch (err) {
    refreshError.value = (err as Error).message ?? String(err)
  } finally {
    loading.value = false
  }
}

function reloadFonts() {
  clearFontCache()
  void refreshFonts()
}

function setFontSize(value: string | number) {
  const n = typeof value === 'string' ? parseInt(value, 10) : value
  if (Number.isFinite(n)) settings.setFontSize(n)
}

function onSansSelect(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  if (v === '__custom__') {
    customSansOpen.value = true
    return
  }
  settings.setSansFont(v)
}

function onMonoSelect(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  if (v === '__custom__') {
    customMonoOpen.value = true
    return
  }
  settings.setMonoFont(v)
}

function submitCustomSans() {
  const v = customSansInput.value.trim()
  if (v) {
    settings.setSansFont(v)
    customSansInput.value = ''
    customSansOpen.value = false
  }
}

function submitCustomMono() {
  const v = customMonoInput.value.trim()
  if (v) {
    settings.setMonoFont(v)
    customMonoInput.value = ''
    customMonoOpen.value = false
  }
}

function isCurrentInList(value: string, list: string[]): boolean {
  return list.includes(value)
}

function goHome() {
  void router.push({ name: 'home' })
}

onMounted(() => {
  void refreshFonts()
})
</script>

<template>
  <section class="settings" data-testid="settings-view">
    <header class="settings__header">
      <button
        type="button"
        class="settings__back"
        @click="goHome"
        data-testid="settings-back"
        title="返回 (Esc)"
      >
        ← 返回
      </button>
      <h1 class="settings__title">设置</h1>
      <button
        type="button"
        class="settings__reset"
        @click="settings.resetAll"
        data-testid="settings-reset"
        title="恢复所有设置为默认值"
      >
        恢复默认
      </button>
    </header>

    <div class="settings__body">
      <section class="settings__group" aria-labelledby="settings-group-appearance">
        <h2 id="settings-group-appearance" class="settings__group-title">外观</h2>

        <div class="settings__row">
          <div class="settings__row-label">
            <span class="settings__row-name">主题</span>
            <span class="settings__row-hint">应用整体配色方案</span>
          </div>
          <div class="settings__row-control" role="radiogroup" aria-label="主题">
            <button
              v-for="t in themes"
              :key="t.value"
              type="button"
              class="settings__chip"
              :class="{ 'is-active': settings.theme === t.value }"
              :aria-pressed="settings.theme === t.value"
              :data-testid="`theme-${t.value}`"
              @click="settings.setTheme(t.value)"
            >
              {{ t.label }}
            </button>
          </div>
        </div>

        <div class="settings__row">
          <div class="settings__row-label">
            <span class="settings__row-name">字体大小</span>
            <span class="settings__row-hint">{{ settings.fontSize }}px（默认 14px）</span>
          </div>
          <div class="settings__row-control">
            <input
              type="range"
              :min="FONT_SIZE_MIN"
              :max="FONT_SIZE_MAX"
              :step="1"
              :value="settings.fontSize"
              data-testid="font-size-slider"
              @input="setFontSize(($event.target as HTMLInputElement).value)"
            />
            <button
              type="button"
              class="settings__mini"
              data-testid="font-size-reset"
              @click="settings.setFontSize(FONT_SIZE_DEFAULT)"
            >
              重置
            </button>
          </div>
        </div>
      </section>

      <section class="settings__group" aria-labelledby="settings-group-fonts">
        <h2 id="settings-group-fonts" class="settings__group-title">字体</h2>

        <div class="settings__row">
          <div class="settings__row-label">
            <span class="settings__row-name">UI 字体</span>
            <span class="settings__row-hint">
              当前：<code class="settings__current">{{ settings.sansFont }}</code>
            </span>
          </div>
          <div class="settings__row-control">
            <select
              :value="isCurrentInList(settings.sansFont, fontList.sans) ? settings.sansFont : '__custom__'"
              data-testid="sans-font-select"
              @change="onSansSelect"
              :disabled="loading"
              class="settings__select"
            >
              <option v-if="loading" value="">加载中…</option>
              <template v-else>
                <option
                  v-for="f in fontList.sans"
                  :key="`sans-${f}`"
                  :value="f"
                >{{ f }}</option>
                <option value="__custom__">自定义…</option>
              </template>
            </select>
            <button
              type="button"
              class="settings__mini"
              data-testid="reload-fonts"
              @click="reloadFonts"
              title="重新读取系统字体列表"
            >
              ↻
            </button>
          </div>
          <div v-if="customSansOpen" class="settings__custom">
            <input
              v-model="customSansInput"
              type="text"
              placeholder="例如：Avenir, Helvetica Neue"
              data-testid="custom-sans-input"
              @keydown.enter="submitCustomSans"
            />
            <button
              type="button"
              class="settings__mini"
              data-testid="custom-sans-submit"
              @click="submitCustomSans"
            >
              确定
            </button>
          </div>
          <p v-if="refreshError" class="settings__error">{{ refreshError }}</p>
        </div>

        <div class="settings__row">
          <div class="settings__row-label">
            <span class="settings__row-name">等宽字体</span>
            <span class="settings__row-hint">
              当前：<code class="settings__current">{{ settings.monoFont }}</code>
            </span>
          </div>
          <div class="settings__row-control">
            <select
              :value="isCurrentInList(settings.monoFont, fontList.mono) ? settings.monoFont : '__custom__'"
              data-testid="mono-font-select"
              @change="onMonoSelect"
              :disabled="loading"
              class="settings__select"
            >
              <option v-if="loading" value="">加载中…</option>
              <template v-else>
                <option
                  v-for="f in fontList.mono"
                  :key="`mono-${f}`"
                  :value="f"
                >{{ f }}</option>
                <option value="__custom__">自定义…</option>
              </template>
            </select>
          </div>
          <div v-if="customMonoOpen" class="settings__custom">
            <input
              v-model="customMonoInput"
              type="text"
              placeholder="例如：Cascadia Code, JetBrains Mono"
              data-testid="custom-mono-input"
              @keydown.enter="submitCustomMono"
            />
            <button
              type="button"
              class="settings__mini"
              data-testid="custom-mono-submit"
              @click="submitCustomMono"
            >
              确定
            </button>
          </div>
        </div>
      </section>

      <section class="settings__group" aria-labelledby="settings-group-editor">
        <h2 id="settings-group-editor" class="settings__group-title">编辑器</h2>

        <div class="settings__row">
          <div class="settings__row-label">
            <span class="settings__row-name">默认视图</span>
            <span class="settings__row-hint">打开文件时使用的布局</span>
          </div>
          <div class="settings__row-control" role="radiogroup" aria-label="默认视图">
            <button
              v-for="m in viewModes"
              :key="m.value"
              type="button"
              class="settings__chip"
              :class="{ 'is-active': settings.viewMode === m.value }"
              :aria-pressed="settings.viewMode === m.value"
              :data-testid="`view-${m.value}`"
              @click="settings.setViewMode(m.value)"
            >
              {{ m.label }}
            </button>
          </div>
        </div>

        <div class="settings__row">
          <div class="settings__row-label">
            <span class="settings__row-name">同步滚动（双栏）</span>
            <span class="settings__row-hint">
              编辑器滚动时按比例驱动预览区；预览区滚动时反之亦然。
              单栏视图下不生效。
            </span>
          </div>
          <div class="settings__row-control">
            <button
              type="button"
              class="settings__chip"
              :class="{ 'is-active': settings.syncScroll }"
              :aria-pressed="settings.syncScroll"
              :data-testid="settings.syncScroll ? 'sync-scroll-on' : 'sync-scroll-off'"
              :disabled="settings.viewMode !== 'split'"
              @click="settings.toggleSyncScroll"
            >
              {{ settings.syncScroll ? '开' : '关' }}
            </button>
          </div>
        </div>
      </section>
    </div>

    <footer class="settings__footer">
      <p class="settings__note">
        所有设置自动保存到 localStorage，下次启动自动恢复。
      </p>
    </footer>
  </section>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background: var(--bg);
  color: var(--fg);
  overflow: hidden;
}

.settings__header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elev);
}

.settings__back,
.settings__reset {
  font: inherit;
  color: var(--fg);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 12px;
  cursor: pointer;
}

.settings__back:hover,
.settings__reset:hover {
  border-color: var(--accent);
}

.settings__title {
  flex: 1;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}

.settings__body {
  flex: 1;
  overflow: auto;
  padding: 24px 32px;
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}

.settings__group {
  margin-bottom: 32px;
}

.settings__group-title {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--fg-muted);
  margin: 0 0 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}

.settings__row {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 16px;
  padding: 14px 0;
  align-items: start;
}

.settings__row-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings__row-name {
  font-weight: 500;
}

.settings__row-hint {
  font-size: 12px;
  color: var(--fg-muted);
}

.settings__current {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--code-bg);
  padding: 1px 4px;
  border-radius: 3px;
}

.settings__row-control {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.settings__chip {
  font: inherit;
  padding: 6px 14px;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 16px;
  cursor: pointer;
}

.settings__chip:hover:not(:disabled) {
  border-color: var(--accent);
}

.settings__chip.is-active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.settings__mini {
  font: inherit;
  font-size: 12px;
  padding: 2px 8px;
  background: var(--bg);
  color: var(--fg-muted);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
}

.settings__mini:hover {
  border-color: var(--accent);
  color: var(--fg);
}

.settings__select {
  flex: 1;
  min-width: 200px;
  padding: 6px 10px;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 4px;
  font: inherit;
}

.settings__select:focus {
  outline: none;
  border-color: var(--accent);
}

.settings__custom {
  grid-column: 2;
  display: flex;
  gap: 8px;
  align-items: center;
}

.settings__custom input {
  flex: 1;
  min-width: 200px;
  padding: 6px 10px;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 4px;
  font: inherit;
}

.settings__row-control input[type='range'] {
  flex: 1;
  min-width: 200px;
  accent-color: var(--accent);
}

.settings__error {
  grid-column: 2;
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--danger);
}

.settings__footer {
  flex: 0 0 auto;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  background: var(--bg-elev);
}

.settings__note {
  margin: 0;
  font-size: 12px;
  color: var(--fg-muted);
  text-align: center;
}
</style>