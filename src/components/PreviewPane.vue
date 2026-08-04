<script setup lang="ts">
import { computed, nextTick, ref, watchEffect } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { renderMarkdown } from '@/markdown/pipeline'

const workspace = useWorkspaceStore()
const html = ref<string>('')
const bodyRef = ref<HTMLElement | null>(null)

watchEffect(async () => {
  const tab = workspace.activeTab
  if (!tab) {
    html.value = ''
    return
  }
  html.value = await renderMarkdown(tab.content)

  // 渲染完后给 PlantUML <img> 挂上失败降级处理：
  // onerror 时把隐藏的 <pre class="plantuml-fallback"> 切到可见。
  await nextTick()
  const root = bodyRef.value
  if (!root) return
  const imgs = root.querySelectorAll<HTMLImageElement>('img.plantuml-diagram')
  imgs.forEach((img) => {
    if (img.dataset.plantumlBound === '1') return
    img.dataset.plantumlBound = '1'
    img.addEventListener('error', () => {
      const container = img.parentElement
      if (!container) return
      const fallback = container.querySelector<HTMLElement>('pre.plantuml-fallback')
      if (fallback) {
        fallback.hidden = false
        img.style.display = 'none'
        container.dataset.plantumlState = 'fallback'
      }
    })
  })
})

const fileName = computed(() => workspace.activeTab?.name ?? '')
</script>

<template>
  <section class="preview-pane">
    <header class="preview-pane__header">
      <span class="preview-pane__title">{{ fileName }} 预览</span>
    </header>
    <article
      ref="bodyRef"
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

/* PlantUML 容器：图默认显示，源码降级块默认隐藏 */
.markdown-body .plantuml-container {
  margin: 1em 0;
  padding: 12px;
  background: var(--bg-elev);
  border-radius: 6px;
  text-align: center;
}

.markdown-body .plantuml-diagram {
  display: inline-block;
  max-width: 100%;
  background: #ffffff; /* PlantUML 默认输出浅色背景，dark mode 下也保持可读 */
}

.markdown-body .plantuml-fallback {
  display: none;
  text-align: left;
}

.markdown-body .plantuml-container[data-plantuml-state='fallback'] .plantuml-fallback {
  display: block;
}
</style>