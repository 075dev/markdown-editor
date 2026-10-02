<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { renderMarkdown } from '@/markdown/pipeline'
import { classifyPreviewLink, resolveDocumentHref } from '@/markdown/linkResolution'
import { canOpenInWindow, openDiagramWindow } from '@/services/diagramWindow'
import { renderMermaidBlocks } from '@/services/mermaid'
import { isTauri } from '@/services/env'
import { openExternal } from '@/services/externalLinks'
import { normalizeError } from '@/services/errors'

const workspace = useWorkspaceStore()
const html = ref<string>('')
const bodyRef = ref<HTMLElement | null>(null)

const emit = defineEmits<{
  (e: 'ready-preview-scroll', el: HTMLElement): void
}>()

/** 链接点击失败统一走状态栏通知(AutoSaveBanner 直接透传 message 展示) */
function notifyLinkError(message: string): void {
  workspace.saveNotice = { level: 'error', message }
}

/**
 * 预览区链接点击路由(add-002,契约 event-flow.md「文档链接跳转约定」):
 * 在容器上注册一次事件委托,v-html 重渲不丢监听。
 * 分类四分支(anchor/external/document/ignored),**一律 preventDefault**,
 * 杜绝 Tauri WebView 在当前窗口内导航冲掉编辑器。
 */
function handlePreviewClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null
  const anchor = target?.closest('a')
  if (!anchor) return
  // 必须 getAttribute:a.href 属性会把 href 以当前页面 base URL 绝对化,
  // 污染相对路径(document 分支解析)与 `#` 锚点判定
  const href = anchor.getAttribute('href')
  event.preventDefault()
  if (href === null) return

  const { kind, fragment } = classifyPreviewLink(href)

  if (kind === 'anchor') {
    const root = bodyRef.value
    if (!root || fragment === null || fragment === '') return
    // 按 id 精确查找。不用 `[id="${CSS.escape(fragment)}"]`:jsdom(测试环境)
    // 无 CSS 全局,且枚举 + 属性精确比较对任意 fragment(中文/引号等)都安全,
    // 语义与转义后的属性选择器一致
    const el =
      Array.from(root.querySelectorAll<HTMLElement>('[id]')).find(
        (node) => node.id === fragment,
      ) ?? null
    // 目标不存在 → 静默忽略(契约边缘场景:无报错无滚动)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }

  if (kind === 'external') {
    // external 的 href 是完整 URL:直接用 getAttribute 原值
    // (不剥 fragment——http 锚点交由目标页处理;mailto 的 query 保持原样)
    openExternal(href).catch((err: unknown) => {
      const qe = normalizeError(err)
      notifyLinkError(`无法打开链接:${qe.message}`)
    })
    return
  }

  if (kind === 'document') {
    if (!isTauri()) {
      // Web 模式没有真实工作区绝对路径体系,文档间跳转不可用
      notifyLinkError('文档间跳转仅桌面版支持')
      return
    }
    const isRootRelative = href.startsWith('/')
    if (isRootRelative && !workspace.rootPath) {
      notifyLinkError('未设置工作区,无法跳转文档链接')
      return
    }
    const currentPath = workspace.activeTab?.path ?? null
    const resolved = resolveDocumentHref(currentPath, workspace.rootPath, href)
    if (resolved === null) {
      notifyLinkError('无法打开链接:无法解析目标文档路径')
      return
    }
    workspace
      .openFileFromPath(resolved)
      .then((ok) => {
        if (!ok) notifyLinkError(`无法打开链接:目标文件不存在或不可读(${resolved})`)
      })
      .catch((err: unknown) => {
        const qe = normalizeError(err)
        notifyLinkError(`无法打开链接:${qe.message}`)
      })
  }

  // kind === 'ignored':仅 preventDefault,无其它动作(危险协议双保险)
}

onMounted(() => {
  const root = bodyRef.value
  if (!root) return
  emit('ready-preview-scroll', root)
  root.addEventListener('click', handlePreviewClick)
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
  // 移除链接点击委托;其余 DOM 状态随组件卸载,无需额外清理。
  bodyRef.value?.removeEventListener('click', handlePreviewClick)
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
  color: var(--text-2);
}

.preview-pane__body {
  flex: 1;
  padding: 24px 32px;
  overflow: auto;
  line-height: 1.75;
  /* 正文染色主题(add-003):内容区底色与文字走 --content-* 语义层 */
  background: var(--content-bg);
  color: var(--content-text);
}
</style>

<style>
/* 正文链接显式化为主题化 --content-link(此前经全局 a 规则染 UI accent 色;
 * follow 模式渲染结果恒等;约定见 event-flow.md add-003) */
.markdown-body a {
  color: var(--syntax-link);
}

/* 标题按 1-6 级分色(add-004 语法语义层);follow 下 h1-h3/h4-h6 分映射内容配色 */
.markdown-body h1,
.markdown-body h2,
.markdown-body h3 {
  margin-top: 1.4em;
  margin-bottom: 0.6em;
}

.markdown-body h1 {
  color: var(--syntax-h1);
}

.markdown-body h2 {
  color: var(--syntax-h2);
}

.markdown-body h3 {
  color: var(--syntax-h3);
}

.markdown-body h4 {
  color: var(--syntax-h4);
}

.markdown-body h5 {
  color: var(--syntax-h5);
}

.markdown-body h6 {
  color: var(--syntax-h6);
}

/* 行内代码/粗体/斜体/删除线走语法语义层(follow 下与现状一致)。
 * 行内代码用 :not(pre) > code 限定——围栏代码块(pre>code)不属语法染色层,
 * 其文字色继承内容配色,内部高亮仍由 --hl-* 驱动 */
.markdown-body :not(pre) > code {
  color: var(--syntax-inline-code);
}

.markdown-body strong {
  color: var(--syntax-bold);
}

.markdown-body em {
  color: var(--syntax-italic);
}

.markdown-body del,
.markdown-body s {
  color: var(--syntax-strikethrough);
}

.markdown-body li::marker {
  color: var(--syntax-list);
}

.markdown-body p {
  margin: 0.6em 0;
}

.markdown-body code {
  font-family: var(--font-mono);
  background: var(--content-code-bg);
  padding: 1px 6px;
  border-radius: calc(var(--radius) - 3px);
  font-size: 0.92em;
}

.markdown-body pre {
  background: var(--content-code-bg);
  border: 1px solid var(--content-code-border);
  padding: 12px 14px;
  border-radius: var(--radius);
  overflow: auto;
}

.markdown-body pre code {
  background: transparent;
  padding: 0;
}

/* 语法高亮五色走主题 token(--hl-*),天然跟随六主题切换。
 * hl-directive / hl-arrow 为 PlantUML 高亮专用 class,语义分别近似
 * 关键字与操作符,复用对应 token。 */
.markdown-body .hl-keyword {
  color: var(--hl-keyword);
  font-weight: 600;
}
.markdown-body .hl-string {
  color: var(--hl-string);
}
.markdown-body .hl-number {
  color: var(--hl-number);
}
.markdown-body .hl-operator {
  color: var(--hl-operator);
}
.markdown-body .hl-directive {
  color: var(--hl-keyword);
  font-weight: 600;
}
.markdown-body .hl-arrow {
  color: var(--hl-number);
}
.markdown-body .hl-comment {
  color: var(--hl-comment);
  font-style: italic;
}

.markdown-body blockquote {
  border-left: 3px solid var(--content-quote-border);
  margin: 0.8em 0;
  padding: 4px 12px;
  color: var(--content-text-2);
  background: var(--content-quote-bg);
}

.markdown-body table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
}

.markdown-body th,
.markdown-body td {
  border: 1px solid var(--content-table-border);
  padding: 6px 10px;
  text-align: left;
}

.markdown-body img {
  max-width: 100%;
  height: auto;
}

.markdown-body hr {
  border: none;
  border-top: 1px solid var(--content-hr);
  margin: 1.5em 0;
}

/* PlantUML 容器：图默认显示，源码降级块默认隐藏 */
.markdown-body .plantuml-container {
  position: relative;
  margin: 1em 0;
  padding: 12px;
  background: var(--content-quote-bg);
  border-radius: var(--radius);
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
  /* 功能性白底(非主题色):PlantUML 服务端渲染的 PNG 为白底,衬底必须与其一致 */
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
  background: var(--content-bg);
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
