/**
 * 编辑区 / 预览区按比例同步滚动。
 *
 * 设计：
 *   - 双向：editor → preview 同步，preview → editor 同步。
 *   - 防回环：用 "locked" 标志 + 短时间窗口（一个 rAF + 下一帧）忽略回弹，
 *           否则我把 preview 的 scrollTop 设过去，preview 的 scroll 事件又触发 → 把
 *           editor 同步回来 → ... 抖动。
 *   - 算法：scrollTop / (scrollHeight - clientHeight) 的比例映射。
 *           比例值裁到 [0, 1]。
 *           短内容（高度等于视口）时 scrollHeight - clientHeight = 0，
 *           把 scrollTop 直接钉成 0 不动。
 *
 * 适用：双栏（split）模式；单栏模式不上挂载。
 */

import { watch, type Ref } from 'vue'

interface ScrollableHTMLElement extends HTMLElement {}

export interface ScrollSyncOptions {
  /** 关闭时立即取消监听、解除锁 */
  enabled: Ref<boolean>
  /** 编辑区可滚动容器（CodeMirror 的 scrollDOM） */
  editorEl: Ref<ScrollableHTMLElement | null>
  /** 预览区可滚动容器（.preview-pane__body） */
  previewEl: Ref<ScrollableHTMLElement | null>
}

export function useEditorScrollSync(options: ScrollSyncOptions) {
  const { enabled, editorEl, previewEl } = options

  const onEditorScroll = () => {
    if (!enabled.value) return
    const editor = editorEl.value
    const preview = previewEl.value
    if (!editor || !preview) return
    if (locked) return
    const ratio = computeRatio(editor)
    locked = true
    applyRatio(preview, ratio)
    requestAnimationFrame(() => {
      locked = false
    })
  }
  const onPreviewScroll = () => {
    if (!enabled.value) return
    const editor = editorEl.value
    const preview = previewEl.value
    if (!editor || !preview) return
    if (locked) return
    const ratio = computeRatio(preview)
    locked = true
    applyRatio(editor, ratio)
    requestAnimationFrame(() => {
      locked = false
    })
  }

  let locked = false
  let attachedEditor: HTMLElement | null = null
  let attachedPreview: HTMLElement | null = null

  // 当容器引用变化时重新挂监听
  watch(
    () => editorEl.value,
    (el) => {
      if (attachedEditor && attachedEditor !== el) {
        attachedEditor.removeEventListener('scroll', onEditorScroll)
        attachedEditor = null
      }
      if (el) {
        attachedEditor = el
        el.addEventListener('scroll', onEditorScroll, { passive: true })
      }
    },
    { immediate: true, flush: 'post' },
  )
  watch(
    () => previewEl.value,
    (el) => {
      if (attachedPreview && attachedPreview !== el) {
        attachedPreview.removeEventListener('scroll', onPreviewScroll)
        attachedPreview = null
      }
      if (el) {
        attachedPreview = el
        el.addEventListener('scroll', onPreviewScroll, { passive: true })
      }
    },
    { immediate: true, flush: 'post' },
  )
}

/* ----------- 纯函数（可测） ----------- */

export function computeRatio(el: HTMLElement): number {
  const max = el.scrollHeight - el.clientHeight
  if (max <= 0) return 0
  return Math.max(0, Math.min(1, el.scrollTop / max))
}

export function applyRatio(el: HTMLElement, ratio: number): void {
  const max = el.scrollHeight - el.clientHeight
  if (max <= 0) {
    if (el.scrollTop !== 0) el.scrollTop = 0
    return
  }
  const target = Math.round(ratio * max)
  if (Math.abs(el.scrollTop - target) > 0.5) {
    el.scrollTop = target
  }
}
