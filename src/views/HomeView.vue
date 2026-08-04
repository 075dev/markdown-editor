<script setup lang="ts">
import { computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSettingsStore } from '@/stores/settings'
import Sidebar from '@/components/Sidebar.vue'
import EditorPane from '@/components/EditorPane.vue'
import PreviewPane from '@/components/PreviewPane.vue'
import TitleBar from '@/components/TitleBar.vue'

const workspace = useWorkspaceStore()
const settings = useSettingsStore()

const isReady = computed(() => workspace.activeTab !== null)
</script>

<template>
  <div class="home" :class="{ 'is-ready': isReady }">
    <TitleBar />
    <div class="home__body">
      <Sidebar class="home__sidebar" />
      <main class="home__main">
        <template v-if="isReady">
          <EditorPane class="home__editor" />
          <div
            class="home__divider"
            role="separator"
            aria-orientation="vertical"
          ></div>
          <PreviewPane class="home__preview" />
        </template>
        <div v-else class="home__empty">
          <h2>MarkDownEditor</h2>
          <p>本地文件优先的 Markdown 编辑器</p>
          <p class="home__hint">
            通过「打开文件」或「打开目录」开始；尚未保存的内容会在标题栏以 · 标记。
          </p>
          <p class="home__ratio">
            当前分割比例：{{ settings.splitRatio.toFixed(2) }}
          </p>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.home__body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.home__sidebar {
  flex: 0 0 240px;
  border-right: 1px solid var(--border);
}

.home__main {
  flex: 1;
  display: flex;
  min-width: 0;
}

.home__editor {
  flex: 1;
  min-width: 0;
}

.home__divider {
  width: 1px;
  background: var(--border);
}

.home__preview {
  flex: 1;
  min-width: 0;
}

.home__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--fg-muted);
  text-align: center;
  padding: 32px;
}

.home__empty h2 {
  margin: 0;
  color: var(--fg);
}

.home__hint {
  max-width: 480px;
  font-size: 13px;
  line-height: 1.6;
}

.home__ratio {
  font-size: 12px;
  opacity: 0.6;
}
</style>