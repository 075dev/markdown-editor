<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { renderMarkdown } from '@/markdown/pipeline'
import { canOpenInWindow, openDiagramWindow } from '@/services/diagramWindow'
import { renderMermaidBlocks } from '@/services/mermaid'

const workspace = useWorkspaceStore()
const html = ref<string>('')
const bodyRef = ref<HTMLElement | null>(null)

const emit = defineEmits<{
  (e: 'ready-preview-scroll', el: HTMLElement): void
}>()

onMounted(() => {
  if (bodyRef.value) emit('ready-preview-scroll', bodyRef.value)
})

watchEffect(async () => {
  const tab = workspace.activeTab
  if (!tab) {
    html.value = ''
    return
  }
  // 显式追踪 content 字符串，让外部 reload（同一 tab 内容变化）能触发重渲
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  tab.content
  html.value = await renderMarkdown(tab.content)

  await nextTick()
  const root = bodyRef.value
  if (!root) return

  // 1) 降级：每个 <img.plantuml-diagram> 挂 onerror
  //    出错时展示 .plantuml-fallback（pre 里是源码）
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

  // 2) 点击图片：在新窗口打开 UML 图（在独立窗口里可缩放）。
  //    注意：新预览行为下，预览区内的图不再支持 pan/zoom 和滚轮缩放，
  //    避免和文本滚动冲突；缩放统一在 openDiagramWindow 独立窗口中提供。
  const containers = Array.from(root.querySelectorAll<HTMLElement>('.plantuml-container'))
  containers.forEach((container) => {
    const img = container.querySelector<HTMLImageElement>('img.plantuml-diagram')
    if (!img) return
    if (container.dataset.openWindowBound === '1') return
    container.dataset.openWindowBound = '1'

    if (!canOpenInWindow()) {
      // Web / jsdom 环境：把容器标为"web-only"，并在 CSS 上隐藏（用户进设置关闭即可）
      container.dataset.mode = 'web'
      return
    }
    container.dataset.mode = 'tauri'
    container.addEventListener('click', (event: Event) => {
      // 点到工具栏按钮（已不存在）或伪元素才过滤：现在容器内只有 <img> + <pre>
      // 这里保留兜底：阻止默认 a 等行为。
      event.preventDefault()
      const source = container.dataset.plantumlSource ?? img.dataset.plantumlSource ?? ''
      void openDiagramWindow({
        url: img.src,
        title: `UML 图 — ${img.alt?.slice(0, 40) || 'PlantUML'}`,
        source,
      })
    })
  })

  // 3) Mermaid 客户端渲染：吞掉错误并保留 fallback。
  //    我们不向上抛 —— 渲染失败时保留 <pre>源码让用户至少能看到定义。
  try {
    await renderMermaidBlocks(root)
  } catch (err) {
    console.error('[PreviewPane] mermaid render pipeline failed:', err)
  }
})

onBeforeUnmount(() => {
  // 不需要清理：DOM 会随 PreviewPane 一起被卸载。
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

/* Shiki 双主题：默认显示 light，dark 模式下显示 dark。 */
.markdown-body pre code span {
  color: var(--shiki-light);
}

@media (prefers-color-scheme: dark) {
  .markdown-body pre code span {
    color: var(--shiki-dark);
  }
}

/* PlantUML 自写高亮：关键字、指令、箭头、注释。 */
.markdown-body .hl-keyword {
  color: #d73a49;
  font-weight: 600;
}
.markdown-body .hl-directive {
  color: #6f42c1;
  font-weight: 600;
}
.markdown-body .hl-arrow {
  color: #005cc5;
}
.markdown-body .hl-comment {
  color: #6a737d;
  font-style: italic;
}

@media (prefers-color-scheme: dark) {
  .markdown-body .hl-keyword { color: #ff7b72; }
  .markdown-body .hl-directive { color: #d2a8ff; }
  .markdown-body .hl-arrow { color: #79c0ff; }
  .markdown-body .hl-comment { color: #8b949e; }
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
  margin: 1em 0;
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
  /*
   * 新行为：预览区内的图不参与 pan/zoom；
   * 点击在新窗口打开（独立窗口提供缩放）。
   * zoom-in 光标 + hover 加亮提示用户「可点开」。
   */
  cursor: zoom-in;
  transition: outline-color 120ms ease;
  outline: 1px solid transparent;
  outline-offset: -1px;
}

.markdown-body .plantuml-container:hover {
  outline-color: var(--accent);
}

/* Web 模式（没有独立窗口能力）维持原 panzoom 提示样式 —— 不过当前没有任何
 * 容器生效路径走 web 分支后还可以再缩放，这里保留 zoom-in 提示用户 "可以双击复制"。 */
.markdown-body .plantuml-container[data-mode='tauri']:active {
  cursor: zoom-out;
}

.markdown-body .plantuml-container[data-mode='web'] {
  cursor: default;
}

.markdown-body .plantuml-diagram {
  display: inline-block;
  max-width: 100%;
  background: #ffffff;
  user-select: none;
  -webkit-user-drag: none;
  /* 不再依赖 transform-origin：panzoom 不再挂在这 */
  transform-origin: 0 0;
}

.markdown-body .plantuml-fallback {
  display: none;
  text-align: left;
}

.markdown-body .plantuml-container[data-plantuml-state='fallback'] .plantuml-fallback {
  display: block;
}

/*
 * Mermaid：<pre.language-mermaid> 被 mermaid.render() 注入 svg 后居中显示。
 * 渲染失败时保持源码 pre 外观。
 */
.markdown-body pre.language-mermaid {
  text-align: center;
  background: var(--bg);
  padding: 12px;
}
.markdown-body pre.language-mermaid svg {
  max-width: 100%;
  height: auto;
  display: inline-block;
}
.markdown-body pre.language-mermaid[data-mermaid-state='pending'] {
  opacity: 0.5;
}
</style>
