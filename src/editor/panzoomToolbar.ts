import panzoomFactory, { type PanZoomInstance } from 'panzoom'
import { canOpenInWindow, openDiagramWindow } from '@/services/diagramWindow'

// panzoom 9.x 在 ESM 下通过 default 导出
const panzoom = (panzoomFactory as unknown as { default?: typeof panzoomFactory }).default
  ?? panzoomFactory

/**
 * Pan/zoom 工具栏封装：
 *   - 把 panzoom 实例挂到目标 <img> 上
 *   - 在容器右下角插入工具栏（缩小 / 重置 / 放大 + 比例显示 + "在新窗口打开"）
 *   - Ctrl+滚轮缩放、双击重置
 *
 * 不依赖 Vue：返回 handle，由调用方持有并负责 dispose。
 */

export interface PanzoomOptions {
  /** 最小缩放 */
  minZoom?: number
  /** 最大缩放 */
  maxZoom?: number
  /** 是否允许 Ctrl+滚轮缩放，默认 true */
  wheelZoom?: boolean
  /** 是否允许双击重置，默认 true */
  dblClickReset?: boolean
  /** 工具栏是否始终显示，默认 false（悬停显示） */
  toolbarAlwaysVisible?: boolean
  /** PlantUML 源码（开启"在新窗口打开"时需要传给后端） */
  plantumlSource?: string
}

export interface PanzoomHandle {
  /** 当前缩放比（1 表示原始大小） */
  getScale(): number
  /** 放大 */
  zoomIn(): void
  /** 缩小 */
  zoomOut(): void
  /** 重置到 100% */
  reset(): void
  /** 在新窗口中打开（Tauri 环境） */
  openInWindow(): Promise<boolean>
  /** 销毁实例、移除 DOM、解除事件 */
  dispose(): void
}

const DEFAULT_OPTS: Required<Omit<PanzoomOptions, 'plantumlSource'>> = {
  minZoom: 0.1,
  maxZoom: 10,
  wheelZoom: true,
  dblClickReset: true,
  toolbarAlwaysVisible: false,
}

/**
 * 给一个 .plantuml-container 容器挂 panzoom 实例与浮动工具栏。
 */
export function mountPanzoomToolbar(
  container: HTMLElement,
  img: HTMLImageElement,
  options: PanzoomOptions = {},
): PanzoomHandle {
  const opts = { ...DEFAULT_OPTS, ...options }

  // 1) 准备工具栏 DOM
  const toolbar = document.createElement('div')
  toolbar.className = 'plantuml-panzoom-toolbar'
  toolbar.setAttribute('role', 'toolbar')
  toolbar.setAttribute('aria-label', 'UML 图缩放工具栏')
  toolbar.dataset.testid = 'plantuml-panzoom-toolbar'

  const btnOut = createButton('zoom-out', '缩小', '−')
  const btnReset = createButton('zoom-reset', '重置缩放', '100%')
  const btnResetSpan = btnReset.querySelector('[data-testid="zoom-reset-label"]') as HTMLElement
  const btnIn = createButton('zoom-in', '放大', '+')

  toolbar.append(btnOut, btnReset, btnIn)

  // 2) 仅 Tauri 环境渲染"在新窗口打开"按钮
  let btnOpenWindow: HTMLButtonElement | null = null
  if (canOpenInWindow()) {
    btnOpenWindow = createButton('open-window', '在新窗口打开', '⧉')
    btnOpenWindow.classList.add('plantuml-panzoom-toolbar__btn--open-window')
    toolbar.appendChild(btnOpenWindow)
  }

  const hint = document.createElement('span')
  hint.className = 'plantuml-panzoom-toolbar__hint'
  hint.textContent = 'Ctrl+滚轮 / 双击重置'
  toolbar.appendChild(hint)

  if (opts.toolbarAlwaysVisible) toolbar.dataset.alwaysVisible = '1'
  container.appendChild(toolbar)

  // 3) 把 panzoom 挂到 <img> 上
  const instance: PanZoomInstance = panzoom(img, {
    minZoom: opts.minZoom,
    maxZoom: opts.maxZoom,
    bounds: false,
    smoothScroll: false,
    beforeWheel: (e) => {
      if (!opts.wheelZoom) return false
      return e.ctrlKey || e.metaKey
    },
    beforeDoubleClick: () => {
      if (!opts.dblClickReset) return false
      return true
    },
  })

  function readScale(): number {
    return instance.getTransform().scale
  }

  function updateLabel() {
    if (!btnResetSpan) return
    btnResetSpan.textContent = `${Math.round(readScale() * 100)}%`
  }

  function centerOrigin() {
    const rect = img.getBoundingClientRect()
    return { x: rect.width / 2, y: rect.height / 2 }
  }

  function zoomIn() {
    const c = centerOrigin()
    const t = instance.getTransform()
    instance.zoomAbs(c.x, c.y, Math.min(opts.maxZoom, t.scale * 1.25))
    updateLabel()
  }

  function zoomOut() {
    const c = centerOrigin()
    const t = instance.getTransform()
    instance.zoomAbs(c.x, c.y, Math.max(opts.minZoom, t.scale / 1.25))
    updateLabel()
  }

  function reset() {
    instance.zoomTo(0, 0, 1)
    updateLabel()
  }

  async function openInWindow(): Promise<boolean> {
    if (!canOpenInWindow() || !img.src) return false
    return openDiagramWindow({
      url: img.src,
      title: `UML 图 — ${img.alt?.slice(0, 40) || 'PlantUML'}`,
      source: opts.plantumlSource,
    })
  }

  btnOut.addEventListener('click', zoomOut)
  btnIn.addEventListener('click', zoomIn)
  btnReset.addEventListener('click', reset)
  btnOpenWindow?.addEventListener('click', () => {
    void openInWindow()
  })

  // zoom 事件同步比例
  instance.on('zoom', () => updateLabel())

  // 双击重置（panzoom 拦截默认 dblclick 后由我们手动重置）
  function onDblClick(e: MouseEvent) {
    if (!opts.dblClickReset) return
    e.preventDefault()
    reset()
  }
  img.addEventListener('dblclick', onDblClick)

  updateLabel()

  return {
    getScale: readScale,
    zoomIn,
    zoomOut,
    reset,
    openInWindow,
    dispose() {
      instance.dispose()
      btnOut.removeEventListener('click', zoomOut)
      btnIn.removeEventListener('click', zoomIn)
      btnReset.removeEventListener('click', reset)
      btnOpenWindow?.removeEventListener('click', () => {
        void openInWindow()
      })
      img.removeEventListener('dblclick', onDblClick)
      toolbar.remove()
    },
  }
}

function createButton(testid: string, label: string, text: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = `plantuml-panzoom-toolbar__btn plantuml-panzoom-toolbar__btn--${testid}`
  btn.dataset.testid = testid
  btn.setAttribute('aria-label', label)
  if (testid === 'zoom-reset') {
    const span = document.createElement('span')
    span.dataset.testid = 'zoom-reset-label'
    span.textContent = text
    btn.appendChild(span)
  } else {
    btn.textContent = text
  }
  return btn
}