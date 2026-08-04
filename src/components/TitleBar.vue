<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSettingsStore, type ViewMode } from '@/stores/settings'

const router = useRouter()
const workspace = useWorkspaceStore()
const settings = useSettingsStore()

const title = computed(() => {
  const tab = workspace.activeTab
  const dirty = workspace.isDirty ? ' ·' : ''
  if (!tab) return 'MarkDownEditor'
  return `${tab.name}${dirty}`
})

const themeLabel = computed(() => {
  switch (settings.theme) {
    case 'light':
      return '☀ 浅色'
    case 'dark':
      return '🌙 深色'
    default:
      return '🖥 跟随系统'
  }
})

const viewButtons: Array<{ mode: ViewMode; label: string; title: string }> = [
  { mode: 'edit', label: '✎', title: '纯编辑 (Ctrl+1)' },
  { mode: 'split', label: '⫶', title: '双栏 (Ctrl+2)' },
  { mode: 'preview', label: '👁', title: '纯预览 (Ctrl+3)' },
]

function setView(mode: ViewMode) {
  settings.setViewMode(mode)
}

function openSettings() {
  void router.push({ name: 'settings' })
}
</script>

<template>
  <header class="titlebar">
    <div class="titlebar__left">
      <span
        class="titlebar__title"
        :class="{ 'titlebar__title--dirty': workspace.isDirty }"
        data-testid="titlebar-title"
      >{{ title }}</span>
      <div
        class="titlebar__view-mode"
        role="tablist"
        aria-label="视图模式"
      >
        <button
          v-for="v in viewButtons"
          :key="v.mode"
          type="button"
          class="titlebar__view-btn"
          :class="{ 'is-active': settings.viewMode === v.mode }"
          :title="v.title"
          :aria-pressed="settings.viewMode === v.mode"
          :data-testid="`view-mode-${v.mode}`"
          @click="setView(v.mode)"
        >
          {{ v.label }}
        </button>
      </div>
    </div>
    <div class="titlebar__actions">
      <button
        type="button"
        @click="workspace.newFile"
        data-testid="new-file"
        title="新建文件 (Ctrl+N)"
      >
        新建
      </button>
      <button
        type="button"
        @click="workspace.openFile"
        data-testid="open-file"
        title="打开文件 (Ctrl+O)"
      >
        打开
      </button>
      <button
        type="button"
        @click="workspace.chooseWorkspace"
        data-testid="open-folder"
        title="打开目录"
      >
        打开目录
      </button>
      <button
        type="button"
        :disabled="!workspace.activeTab"
        @click="workspace.saveActive"
        data-testid="save-file"
        title="保存 (Ctrl+S)"
      >
        保存
      </button>
      <button
        type="button"
        :disabled="!workspace.activeTab"
        @click="workspace.saveAsActive"
        data-testid="save-as"
        title="另存为 (Ctrl+Shift+S)"
      >
        另存为
      </button>
      <button
        type="button"
        @click="openSettings"
        data-testid="open-settings"
        title="设置 (Ctrl+,)"
        aria-label="设置"
      >
        ⚙
      </button>
      <button
        type="button"
        @click="settings.toggleTheme"
        data-testid="toggle-theme"
      >
        {{ themeLabel }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.titlebar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elev);
}

.titlebar__left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.titlebar__title {
  font-weight: 600;
  font-size: 13px;
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.titlebar__title--dirty::after {
  content: ' ●';
  color: var(--accent);
  font-size: 14px;
}

.titlebar__view-mode {
  display: flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
}

.titlebar__view-btn {
  min-width: 28px;
  height: 22px;
  padding: 0 8px;
  border: none;
  background: transparent;
  border-radius: 3px;
  color: var(--fg-muted);
  cursor: pointer;
  font: inherit;
}

.titlebar__view-btn:hover:not(:disabled) {
  background: var(--bg-elev);
  color: var(--fg);
}

.titlebar__view-btn.is-active {
  background: var(--accent);
  color: white;
}

.titlebar__actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
</style>