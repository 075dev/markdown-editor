<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { createMarkdownEditor, type CreatedEditor } from '@/editor/createEditor'

const workspace = useWorkspaceStore()
const containerRef = ref<HTMLDivElement | null>(null)
let editor: CreatedEditor | null = null

onMounted(() => {
  if (!containerRef.value) return
  editor = createMarkdownEditor(containerRef.value, {
    initialDoc: workspace.activeTab?.content ?? '',
    onChange: (value) => {
      workspace.updateActiveContent(value)
    },
  })
})

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