<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSettingsStore, toFontStack } from '@/stores/settings'
import { createMarkdownEditor, type CreatedEditor } from '@/editor/createEditor'
import { readTextFile } from '@/services/fileService'

const workspace = useWorkspaceStore()
const settings = useSettingsStore()
const containerRef = ref<HTMLDivElement | null>(null)
let editor: CreatedEditor | null = null

const emit = defineEmits<{
  (e: 'ready-editor-scroll', el: HTMLElement): void
}>()

onMounted(() => {
  if (!containerRef.value) return
  editor = createMarkdownEditor(containerRef.value, {
    initialDoc: workspace.activeTab?.content ?? '',
    monoFont: toFontStack(settings.monoFont, 'mono'),
    fontSize: settings.fontSize,
    onChange: (value) => {
      workspace.updateActiveContent(value)
    },
  })

  // 监听外部修改事件：从磁盘重新读取并写入编辑器
  window.addEventListener('mde:reload-tab', onReload as EventListener)

  // 把 CM 的 scrollDOM 冒泡给 HomeView，做同步滚动联动。
  // CM view.scrollDOM 是真正带 overflow:auto 的容器。
  if (editor) {
    const scrollEl = editor.getScrollElement()
    if (scrollEl) emit('ready-editor-scroll', scrollEl)
  }
})

// 监听 settings 变化，实时更新 CodeMirror 字体与字号
watch(
  () => [settings.monoFont, settings.fontSize] as const,
  ([monoFont, fontSize]) => {
    if (!editor) return
    editor.applyTheme({
      monoFont: toFontStack(monoFont, 'mono'),
      fontSize,
    })
  },
)

watch(
  () => workspace.activeTabPath,
  () => {
    if (!editor) return
    const tab = workspace.activeTab
    editor.setValue(tab?.content ?? '')
  },
)

/**
 * 处理外部文件修改事件：重新读盘并替换编辑器内容。
 * Q2 决策：冲突时**外部覆盖**本地未保存修改（简化策略）。
 */
async function onReload(e: Event) {
  const detail = (e as CustomEvent<{ path: string }>).detail
  if (!detail?.path) return
  const tab = workspace.tabs.find((t) => t.path === detail.path)
  if (!tab) return
  const fresh = await readTextFile(detail.path)
  if (fresh === null) return
  // 只在仍然是同一标签时刷新；避免异步读盘期间用户切到其它标签
  if (workspace.activeTabPath !== detail.path) return
  tab.content = fresh
  tab.savedContent = fresh
  // 强制刷新 editor（activeTabPath 没变也要刷）
  editor?.setValue(fresh)
}

onBeforeUnmount(() => {
  window.removeEventListener('mde:reload-tab', onReload as EventListener)
  editor?.destroy()
  editor = null
})
</script>

<template>
  <section class="editor-pane">
    <div ref="containerRef" class="editor-pane__host" data-testid="editor-host"></div>
  </section>
</template>

<style scoped>
.editor-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  background: var(--bg);
}

.editor-pane__host {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>