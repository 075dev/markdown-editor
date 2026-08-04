<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSettingsStore, toFontStack } from '@/stores/settings'
import { createMarkdownEditor, type CreatedEditor } from '@/editor/createEditor'

const workspace = useWorkspaceStore()
const settings = useSettingsStore()
const containerRef = ref<HTMLDivElement | null>(null)
let editor: CreatedEditor | null = null

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

onBeforeUnmount(() => {
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