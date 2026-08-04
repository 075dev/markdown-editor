<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSettingsStore } from '@/stores/settings'
import Sidebar from '@/components/Sidebar.vue'
import EditorPane from '@/components/EditorPane.vue'
import PreviewPane from '@/components/PreviewPane.vue'
import TitleBar from '@/components/TitleBar.vue'

const router = useRouter()
const workspace = useWorkspaceStore()
const settings = useSettingsStore()

const isReady = computed(() => workspace.activeTab !== null)
const viewMode = computed(() => settings.viewMode)

const showEditor = computed(() => viewMode.value !== 'preview')
const showPreview = computed(() => viewMode.value !== 'edit')

/**
 * 全局快捷键：
 *   Ctrl+S         - 保存当前
 *   Ctrl+Shift+S   - 另存为
 *   Ctrl+N         - 新建文件
 *   Ctrl+O         - 打开文件
 *   Ctrl+1/2/3     - 视图切换（编辑/双栏/预览）
 */
function onKeyDown(e: KeyboardEvent) {
  const ctrl = e.ctrlKey || e.metaKey
  if (!ctrl) return
  const k = e.key.toLowerCase()
  // 防止在 input/textarea 内编辑时误触
  const target = e.target as HTMLElement | null
  const inField =
    !!target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable)
  if (k === 's' && !e.shiftKey) {
    e.preventDefault()
    void workspace.saveActive()
  } else if (k === 's' && e.shiftKey) {
    e.preventDefault()
    void workspace.saveAsActive()
  } else if (k === 'n' && !inField) {
    e.preventDefault()
    void workspace.newFile()
  } else if (k === 'o' && !inField) {
    e.preventDefault()
    void workspace.openFile()
  } else if (k === '1') {
    e.preventDefault()
    settings.setViewMode('edit')
  } else if (k === '2') {
    e.preventDefault()
    settings.setViewMode('split')
  } else if (k === '3') {
    e.preventDefault()
    settings.setViewMode('preview')
  } else if (k === ',') {
    // Ctrl+, 打开设置（Mac: ⌘+,）
    e.preventDefault()
    void router.push({ name: 'settings' })
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div class="home" :class="['home--' + viewMode, { 'is-ready': isReady }]">
    <TitleBar />
    <div class="home__body">
      <Sidebar class="home__sidebar" />
      <main class="home__main">
        <template v-if="isReady">
          <EditorPane v-if="showEditor" class="home__editor" />
          <div
            v-if="showEditor && showPreview"
            class="home__divider"
            role="separator"
            aria-orientation="vertical"
          ></div>
          <PreviewPane v-if="showPreview" class="home__preview" />
        </template>
        <div v-else class="home__empty">
          <h2>MarkDownEditor</h2>
          <p>本地文件优先的 Markdown 编辑器</p>
          <p class="home__hint">
            通过「新建」「打开文件」或「打开目录」开始；尚未保存的内容会在标题栏以 · 标记。
          </p>
          <p class="home__shortcuts">
            快捷键：Ctrl+N 新建 · Ctrl+O 打开 · Ctrl+S 保存 · Ctrl+1/2/3 切换视图
          </p>
          <p class="home__ratio">
            当前分割比例：{{ settings.splitRatio.toFixed(2) }} ·
            视图模式：{{ viewMode }}
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

.home__shortcuts {
  font-size: 12px;
  opacity: 0.7;
  margin-top: 8px;
}

.home__ratio {
  font-size: 12px;
  opacity: 0.6;
  margin-top: 4px;
}
</style>