<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { renderMarkdown } from '@/markdown/pipeline'

const workspace = useWorkspaceStore()
const html = ref<string>('')

watchEffect(async () => {
  const tab = workspace.activeTab
  if (!tab) {
    html.value = ''
    return
  }
  html.value = await renderMarkdown(tab.content)
})

const fileName = computed(() => workspace.activeTab?.name ?? '')
</script>

<template>
  <section class="preview-pane">
    <header class="preview-pane__header">
      <span class="preview-pane__title">{{ fileName }} 预览</span>
    </header>
    <article
      class="preview-pane__body markdown-body"
      v-html="html"
      data-testid="preview-body"
    ></article>
  </section>
</template>

<style scoped>
.preview-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  background: var(--bg);
}

.preview-pane__header {
  flex: 0 0 auto;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elev);
  font-size: 12px;
  color: var(--fg-muted);
}

.preview-pane__body {
  flex: 1;
  padding: 24px 32px;
  overflow: auto;
  line-height: 1.75;
}
</style>

<style>
.markdown-body h1,
.markdown-body h2,
.markdown-body h3 {
  margin-top: 1.4em;
  margin-bottom: 0.6em;
  color: var(--fg);
}

.markdown-body p {
  margin: 0.6em 0;
}

.markdown-body code {
  font-family: var(--font-mono);
  background: var(--code-bg);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.92em;
}

.markdown-body pre {
  background: var(--code-bg);
  padding: 12px 14px;
  border-radius: 6px;
  overflow: auto;
}

.markdown-body pre code {
  background: transparent;
  padding: 0;
}

.markdown-body blockquote {
  border-left: 3px solid var(--accent);
  margin: 0.8em 0;
  padding: 4px 12px;
  color: var(--fg-muted);
  background: var(--bg-elev);
}

.markdown-body table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.8em 0;
}

.markdown-body th,
.markdown-body td {
  border: 1px solid var(--border);
  padding: 6px 10px;
  text-align: left;
}

.markdown-body img {
  max-width: 100%;
  height: auto;
}

.markdown-body hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 1.5em 0;
}
</style>