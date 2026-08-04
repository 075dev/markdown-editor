<script setup lang="ts">
import { computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'

const workspace = useWorkspaceStore()

const rootLabel = computed(() => workspace.rootPath ?? '尚未打开目录')

function handleClose(path: string) {
  const ok = workspace.closeTab(path)
  if (ok) return
  // 有未保存改动：弹原生确认
  // Tauri WebView 下 confirm 会被自动支持；Web 环境同样支持。
  const discard = window.confirm('当前文件有未保存的修改，确定要关闭吗？')
  if (discard) {
    workspace.forceCloseTab(path)
  }
}
</script>

<template>
  <aside class="sidebar">
    <section class="sidebar__section">
      <header class="sidebar__header">目录</header>
      <div class="sidebar__root">{{ rootLabel }}</div>
      <ul v-if="workspace.tree.length" class="sidebar__list">
        <li
          v-for="entry in workspace.tree"
          :key="entry.path"
          class="sidebar__item"
          :class="{ 'sidebar__item--dir': entry.isDir }"
        >
          <span class="sidebar__icon">{{ entry.isDir ? '📁' : '📄' }}</span>
          <span class="sidebar__name">{{ entry.name }}</span>
        </li>
      </ul>
      <p v-else class="sidebar__empty">
        在桌面端打开目录后会显示文件树。
      </p>
    </section>
    <section class="sidebar__section">
      <header class="sidebar__header">标签</header>
      <ul v-if="workspace.tabs.length" class="sidebar__tabs">
        <li
          v-for="tab in workspace.tabs"
          :key="tab.path"
          class="sidebar__tab"
          :class="{
            'is-active': workspace.activeTabPath === tab.path,
            'is-dirty': workspace.isTabDirty(tab.path),
          }"
          @click="workspace.activateTab(tab.path)"
          :data-testid="`tab-${tab.path}`"
        >
          <span class="sidebar__tab-name">{{ tab.name }}</span>
          <button
            type="button"
            class="sidebar__tab-close"
            @click.stop="handleClose(tab.path)"
            aria-label="关闭标签"
          >
            ×
          </button>
        </li>
      </ul>
      <p v-else class="sidebar__empty">尚未打开任何文件。</p>
    </section>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: var(--bg-sidebar);
  overflow: auto;
  height: 100%;
}

.sidebar__section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sidebar__header {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--fg-muted);
}

.sidebar__root {
  font-size: 12px;
  color: var(--fg-muted);
  word-break: break-all;
}

.sidebar__list,
.sidebar__tabs {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar__item,
.sidebar__tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}

.sidebar__item:hover,
.sidebar__tab:hover {
  background: var(--bg-elev);
}

.sidebar__tab.is-active {
  background: var(--bg-elev);
  color: var(--accent);
}

.sidebar__tab.is-dirty .sidebar__tab-name::before {
  content: '● ';
  color: var(--accent);
}

.sidebar__tab-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar__tab-close {
  border: none;
  background: transparent;
  font-size: 14px;
  color: var(--fg-muted);
  padding: 0 4px;
  border-radius: 4px;
}

.sidebar__tab-close:hover {
  color: var(--danger);
  background: var(--bg-elev);
}

.sidebar__empty {
  font-size: 12px;
  color: var(--fg-muted);
  margin: 0;
}
</style>