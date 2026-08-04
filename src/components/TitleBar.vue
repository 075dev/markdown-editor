<script setup lang="ts">
import { computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSettingsStore } from '@/stores/settings'

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
</script>

<template>
  <header class="titlebar">
    <div class="titlebar__title">{{ title }}</div>
    <div class="titlebar__actions">
      <button type="button" @click="workspace.openFile" data-testid="open-file">
        打开文件
      </button>
      <button type="button" @click="workspace.chooseWorkspace" data-testid="open-folder">
        打开目录
      </button>
      <button
        type="button"
        :disabled="!workspace.activeTab"
        @click="workspace.saveActive"
        data-testid="save-file"
      >
        保存
      </button>
      <button type="button" @click="settings.toggleTheme" data-testid="toggle-theme">
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
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elev);
}

.titlebar__title {
  font-weight: 600;
  font-size: 13px;
  color: var(--fg);
}

.titlebar__actions {
  display: flex;
  gap: 8px;
}
</style>