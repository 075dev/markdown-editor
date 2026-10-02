<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  useSettingsStore,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_DEFAULT,
  THEMES,
  THEME_LABELS,
  CONTENT_THEMES,
  CONTENT_THEME_LABELS,
  type Theme,
  type ContentTheme,
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

/** 六主题 + system 特殊卡(卡片网格渲染顺序;system 固定末位) */
const themeCards: Array<{ value: Theme; label: string; system: boolean }> = [
  ...THEMES.map((value) => ({ value, label: THEME_LABELS[value], system: false })),
  { value: 'system', label: THEME_LABELS.system, system: true },
]

const viewModes: Array<{ value: ViewMode; label: string; hint: string }> = [
  { value: 'edit', label: '纯编辑', hint: '只显示编辑器' },
  { value: 'split', label: '双栏', hint: '编辑器 + 预览' },
  { value: 'preview', label: '纯预览', hint: '只显示预览' },
]

/** 正文染色方案选项(add-003;select 渲染顺序 = CONTENT_THEMES 声明序) */
const contentThemeOptions: Array<{ value: ContentTheme; label: string }> =
  CONTENT_THEMES.map((value) => ({ value, label: CONTENT_THEME_LABELS[value] }))

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
          <div class="settings__row-control">
            <div class="theme-grid" role="radiogroup" aria-label="主题">
              <button
                v-for="t in themeCards"
                :key="t.value"
                type="button"
                class="theme-card"
                :class="{ 'is-active': settings.theme === t.value }"
                role="radio"
                :aria-checked="settings.theme === t.value"
                :data-testid="`theme-${t.value}`"
                @click="settings.setTheme(t.value)"
              >
                <span
                  v-if="t.system"
                  class="theme-card__preview theme-card__preview--system"
                  aria-hidden="true"
                >
                  <span class="theme-card__sys-icon" />
                </span>
                <span
                  v-else
                  class="theme-card__preview"
                  :data-swatch="t.value"
                  aria-hidden="true"
                >
                  <span class="theme-card__swatch theme-card__swatch--bg" />
                  <span class="theme-card__swatch theme-card__swatch--side" />
                  <span class="theme-card__swatch theme-card__swatch--accent" />
                </span>
                <span class="theme-card__name">{{ t.label }}</span>
                <span
                  v-if="settings.theme === t.value"
                  class="theme-card__check"
                  aria-hidden="true"
                >✓</span>
              </button>
            </div>
          </div>
        </div>

        <div class="settings__row">
          <div class="settings__row-label">
            <span class="settings__row-name">正文染色</span>
            <span class="settings__row-hint">预览区正文的独立配色(与界面主题分开)</span>
          </div>
          <div class="settings__row-control">
            <select
              :value="settings.contentTheme"
              class="settings__select"
              data-testid="content-theme-select"
              aria-label="正文染色主题"
              @change="settings.setContentTheme(($event.target as HTMLSelectElement).value as ContentTheme)"
            >
              <option v-for="c in contentThemeOptions" :key="c.value" :value="c.value">
                {{ c.label }}
              </option>
            </select>
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

        <div class="settings__row">
          <div class="settings__row-label">
            <span class="settings__row-name">自动保存</span>
            <span class="settings__row-hint">
              内容变更 1.5 秒后自动保存,窗口失焦时立即保存全部未保存标签;
              保存失败自动重试。关闭后仅 Ctrl+S 手动保存,冲突安全网仍生效。
            </span>
          </div>
          <div class="settings__row-control">
            <button
              type="button"
              class="settings__chip"
              :class="{ 'is-active': settings.autoSaveEnabled }"
              :aria-pressed="settings.autoSaveEnabled"
              :data-testid="settings.autoSaveEnabled ? 'autosave-on' : 'autosave-off'"
              @click="settings.toggleAutoSaveEnabled"
            >
              {{ settings.autoSaveEnabled ? '开' : '关' }}
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
  color: var(--text-1);
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
  color: var(--text-1);
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
  color: var(--text-2);
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
  color: var(--text-2);
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

/* ---------- 主题卡片选择器(add-001) ---------- */
.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(128px, 1fr));
  gap: 10px;
  width: 100%;
}

.theme-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  padding: 10px 10px 12px;
  background: var(--bg);
  color: var(--text-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  box-shadow: var(--shadow-1);
}

.theme-card:hover {
  border-color: var(--accent);
}

.theme-card.is-active {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent), var(--shadow-1);
}

.theme-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.theme-card__preview {
  display: flex;
  flex-direction: column;
  gap: 3px;
  height: 48px;
  padding: 5px;
  border: 1px solid var(--border-strong);
  border-radius: calc(var(--radius) - 2px);
  background: var(--sw-bg, var(--bg-elev));
}

.theme-card__preview--system {
  align-items: center;
  justify-content: center;
  background: var(--bg-elev);
}

/* 纯 CSS 显示器图标(跟随系统特殊卡) */
.theme-card__sys-icon {
  position: relative;
  width: 20px;
  height: 13px;
  border: 2px solid var(--text-2);
  border-radius: 2px;
}

.theme-card__sys-icon::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -7px;
  transform: translateX(-50%);
  width: 10px;
  height: 2px;
  background: var(--text-2);
}

.theme-card__swatch {
  display: block;
  flex: 1;
  border-radius: 2px;
}

.theme-card__swatch--side {
  background: var(--sw-side, transparent);
}

.theme-card__swatch--accent {
  flex: 0 0 9px;
  background: var(--sw-accent, var(--accent));
}

/* 各主题代表色样本(与 global.css 对应主题的 --bg/--bg-sidebar/--accent 一致) */
.theme-card__preview[data-swatch='light'] {
  --sw-bg: #ffffff;
  --sw-side: #f2f3f6;
  --sw-accent: #4f46e5;
}

.theme-card__preview[data-swatch='dark'] {
  --sw-bg: #0f1115;
  --sw-side: #12141b;
  --sw-accent: #6d8bff;
}

.theme-card__preview[data-swatch='oled'] {
  --sw-bg: #000000;
  --sw-side: #050507;
  --sw-accent: #6e9fff;
}

.theme-card__preview[data-swatch='paper'] {
  --sw-bg: #faf4e8;
  --sw-side: #f5eedf;
  --sw-accent: #a3692d;
}

.theme-card__preview[data-swatch='bluegray'] {
  --sw-bg: #f0f3f7;
  --sw-side: #eaeef4;
  --sw-accent: #2e6f9e;
}

.theme-card__preview[data-swatch='rose'] {
  --sw-bg: #211a1e;
  --sw-side: #241c20;
  --sw-accent: #e8758f;
}

.theme-card__name {
  font-size: 13px;
  text-align: center;
  color: var(--text-1);
}

.theme-card.is-active .theme-card__name {
  color: var(--accent-text);
  font-weight: 600;
}

.theme-card__check {
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 12px;
  color: var(--accent-text);
  font-weight: 700;
}

.settings__chip {
  font: inherit;
  padding: 6px 14px;
  background: var(--bg);
  color: var(--text-1);
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
  color: var(--text-2);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
}

.settings__mini:hover {
  border-color: var(--accent);
  color: var(--text-1);
}

.settings__select {
  flex: 1;
  min-width: 200px;
  padding: 6px 10px;
  background: var(--bg);
  color: var(--text-1);
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
  color: var(--text-1);
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
  color: var(--text-2);
  text-align: center;
}
</style>