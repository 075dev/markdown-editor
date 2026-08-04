<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watchEffect } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { renderMarkdown } from '@/markdown/pipeline'
import { mountPanzoomToolbar, type PanzoomHandle } from '@/editor/panzoomToolbar'

const workspace = useWorkspaceStore()
const html = ref<string>('')
const bodyRef = ref<HTMLElement | null>(null)

const handles = new WeakMap<HTMLElement, PanzoomHandle>()

watchEffect(async () => {
  const tab = workspace.activeTab
  if (!tab) {
    html.value = ''
    return
  }
  html.value = await renderMarkdown(tab.content)

  await nextTick()
  const root = bodyRef.value
  if (!root) return

  // 1) 降级：每个 <img.plantuml-diagram> 挂 onerror
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img.plantuml-diagram'))
  imgs.forEach((img) => {
    if (img.dataset.plantumlBound === '1') return
    img.dataset.plantumlBound = '1'
    img.addEventListener('error', () => {
      const container = img.closest<HTMLElement>('.plantuml-container')
      if (!container) return
      const fallback = container.querySelector<HTMLElement>('pre.plantuml-fallback')
      if (fallback) {
        fallback.hidden = false
        img.style.display = 'none'
        container.dataset.plantumlState = 'fallback'
      }
    })
  })

  // 2) pan/zoom：每个 .plantuml-container 实例化一个 panzoom + 工具栏
  const containers = Array.from(root.querySelectorAll<HTMLElement>('.plantuml-container'))
  containers.forEach((container) => {
    if (handles.has(container)) return
    const img = container.querySelector<HTMLImageElement>('img.plantuml-diagram')
    if (!img) return
    // plantumlRehype 把源码挂在 data-plantuml-source 上
    const source = container.dataset.plantumlSource ?? img.dataset.plantumlSource ?? ''
    const handle = mountPanzoomToolbar(container, img, { plantumlSource: source })
    handles.set(container, handle)
  })
})

onBeforeUnmount(() => {
  // WeakMap 自动 GC；如果要立刻释放可遍历 body 子节点
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
  position: relative;
  margin: 1em 0;
  padding: 12px;
  background: var(--bg-elev);
  border-radius: 6px;
  text-align: center;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
}

.markdown-body .plantuml-container:active {
  cursor: grabbing;
}

.markdown-body .plantuml-diagram {
  display: inline-block;
  max-width: 100%;
  background: #ffffff;
  user-select: none;
  -webkit-user-drag: none;
  transform-origin: 0 0;
}

.markdown-body .plantuml-fallback {
  display: none;
  text-align: left;
}

.markdown-body .plantuml-container[data-plantuml-state='fallback'] .plantuml-fallback {
  display: block;
}

/* pan/zoom 浮动工具栏：默认悬停显示 */
.plantuml-panzoom-toolbar {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border-radius: 6px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  font-size: 12px;
  user-select: none;
  opacity: 0;
  transition: opacity 160ms ease;
  z-index: 2;
}

.markdown-body .plantuml-container:hover .plantuml-panzoom-toolbar,
.plantuml-panzoom-toolbar:focus-within,
.plantuml-panzoom-toolbar[data-always-visible='1'] {
  opacity: 1;
}

.plantuml-panzoom-toolbar__btn {
  min-width: 28px;
  height: 24px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  background: var(--bg);
  border-radius: 4px;
  font: inherit;
  color: var(--fg);
  cursor: pointer;
}

.plantuml-panzoom-toolbar__btn:hover {
  background: var(--bg-elev);
  border-color: var(--accent);
}

.plantuml-panzoom-toolbar__btn--zoom-reset {
  min-width: 56px;
  font-variant-numeric: tabular-nums;
}

.plantuml-panzoom-toolbar__btn--open-window {
  font-size: 14px;
  color: var(--accent);
}

.plantuml-panzoom-toolbar__hint {
  margin-left: 4px;
  padding-left: 6px;
  border-left: 1px solid var(--border);
  color: var(--fg-muted);
  font-size: 11px;
  white-space: nowrap;
}
</style>