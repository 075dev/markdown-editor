/**
 * 独立 PlantUML 图查看窗口的入口脚本。
 *
 * 通过 window.location.search 读取三个参数：
 *   - url: PlantUML 渲染服务的完整 URL（必填）
 *   - title: 窗口标题
 *   - source: PlantUML 原始源码（用于"复制源码"）
 *
 * 使用 panzoom（与主预览一致）实现平移和缩放。
 */

import panzoomFactory from 'panzoom'

const panzoom = (panzoomFactory as unknown as { default?: typeof panzoomFactory }).default
  ?? panzoomFactory

interface Params {
  url: string
  title: string
  source: string
}

function readParams(): Params {
  const search = new URLSearchParams(window.location.search)
  return {
    url: search.get('url') ?? '',
    title: search.get('title') ?? 'UML 图',
    source: search.get('source') ?? '',
  }
}

function showError(message: string) {
  const stage = document.getElementById('stage')!
  stage.innerHTML = `<pre class="error">${message}</pre>`
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    // Fallback for older WebView: textarea + execCommand
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch (err) {
    console.error('[diagram] clipboard write failed:', err)
    return false
  }
}

async function copyImageToClipboard(img: HTMLImageElement): Promise<boolean> {
  // 1. 优先尝试 ClipboardItem（支持 PNG）
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      // 跨域图片可能被 tainted，无法直接 toBlob —— 此时画到 canvas 会失败
      const blob = await new Promise<Blob | null>((resolve) => {
        img.crossOrigin = 'anonymous'
        const canvas = document.createElement('canvas')
        const w = img.naturalWidth || img.width
        const h = img.naturalHeight || img.height
        if (w === 0 || h === 0) return resolve(null)
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(null)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob((b) => resolve(b), 'image/png')
      })
      if (blob) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        return true
      }
    }
  } catch (err) {
    console.warn('[diagram] clipboard image write failed, falling back:', err)
  }
  // 2. 退化：用 a[download] 触发下载
  try {
    const a = document.createElement('a')
    a.href = img.src
    a.download = 'plantuml.png'
    a.click()
    return true
  } catch (err) {
    console.error('[diagram] fallback download failed:', err)
    return false
  }
}

function flashStatus(text: string) {
  const el = document.getElementById('status')!
  el.textContent = text
  el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), 1400)
}

function setup() {
  const params = readParams()
  if (!params.url) {
    showError('缺少 url 参数（应为 ?url=...）')
    return
  }

  // 设置标题
  document.getElementById('title')!.textContent = params.title

  const img = document.getElementById('diagram') as HTMLImageElement
  void document.getElementById('stage')

  // 复制按钮
  const copySourceBtn = document.getElementById('copy-source') as HTMLButtonElement
  const copyImageBtn = document.getElementById('copy-image') as HTMLButtonElement

  if (params.source) {
    copySourceBtn.disabled = false
    copySourceBtn.addEventListener('click', async () => {
      const ok = await copyToClipboard(params.source)
      flashStatus(ok ? '已复制源码' : '复制失败')
    })
  }

  copyImageBtn.disabled = false
  copyImageBtn.addEventListener('click', async () => {
    const ok = await copyImageToClipboard(img)
    flashStatus(ok ? '已复制图片（或已触发下载）' : '复制失败')
  })

  // 工具栏
  const btnOut = document.getElementById('zoom-out') as HTMLButtonElement
  const btnReset = document.getElementById('zoom-reset') as HTMLButtonElement
  const btnIn = document.getElementById('zoom-in') as HTMLButtonElement

  // 图片加载完成后再挂 panzoom
  img.addEventListener('load', () => {
    img.style.width = `${img.naturalWidth}px`
    img.style.height = `${img.naturalHeight}px`
    img.style.transform = 'translate(-50%, -50%) scale(1)'

    const instance = panzoom(img, {
      minZoom: 0.1,
      maxZoom: 10,
      bounds: false,
      smoothScroll: false,
      beforeWheel: (e) => e.ctrlKey || e.metaKey,
      beforeDoubleClick: () => true,
    })

    function readScale() {
      return instance.getTransform().scale
    }
    function updateLabel() {
      btnReset.textContent = `${Math.round(readScale() * 100)}%`
    }
    function centerOrigin() {
      const rect = img.getBoundingClientRect()
      return { x: rect.width / 2, y: rect.height / 2 }
    }
    function zoomIn() {
      const c = centerOrigin()
      const t = instance.getTransform()
      instance.zoomAbs(c.x, c.y, Math.min(10, t.scale * 1.25))
      updateLabel()
    }
    function zoomOut() {
      const c = centerOrigin()
      const t = instance.getTransform()
      instance.zoomAbs(c.x, c.y, Math.max(0.1, t.scale / 1.25))
      updateLabel()
    }
    function reset() {
      instance.zoomTo(0, 0, 1)
      updateLabel()
    }

    btnOut.addEventListener('click', zoomOut)
    btnIn.addEventListener('click', zoomIn)
    btnReset.addEventListener('click', reset)

    instance.on('zoom', () => updateLabel())

    img.addEventListener('dblclick', (e) => {
      e.preventDefault()
      reset()
    })

    updateLabel()
  })

  img.addEventListener('error', () => {
    showError(`图片加载失败：\n${params.url}\n\n请检查网络或 PlantUML 源码是否合法。`)
  })

  img.src = params.url
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setup)
} else {
  setup()
}