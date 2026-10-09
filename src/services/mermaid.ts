/**
 * Mermaid 客户端渲染。
 *
 * 关键点：
 *   - mermaid 11 的 `mermaid.run({nodes})` 在节点已脱离 document 时会
 *     内部触发 "'children' in undefined" 崩溃（依赖 d3 selection 对节点树
 *     的若干假设）。我们改走更稳的姿势：
 *     1) `mermaid.render(id, source, containerElem)`
 *     2) `containerElem` 必须 *真实*挂在 document.body 里（mermaid 在它
 *        内部用 d3 select 节点；脱离 document 的节点 d3 路径会断）。
 *     3) 拿回 svg 字符串后，自己 innerHTML 到目标容器，再清理临时节点。
 *   - pipeline 不感知 mermaid —— 输出 <pre class="language-mermaid"><code>源码</code></pre>，
 *     PreviewPane 在客户端扫这些 pre 渲染。
 *   - 渲染失败：保留 pre 作为 fallback（不丢内容），同时在 console 留错误，
 *     方便用户排查。
 */

import type { Mermaid } from 'mermaid'

type RenderResult = { svg: string; bindFunctions?: (el: Element) => void }
type MermaidAPI = {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, text: string, container?: Element) => Promise<RenderResult>
}

let mermaidPromise: Promise<MermaidAPI> | null = null

function getMermaid(): Promise<MermaidAPI> {
  if (!mermaidPromise) {
    mermaidPromise = (async () => {
      const mod = await import('mermaid')
      const api = ((mod as unknown as { default?: Mermaid }).default ??
        (mod as unknown as Mermaid)) as unknown as MermaidAPI
      // 用一个空对象起步：避免 mermaid 11 因为 schema 字段变更在某处
      // 触发 'field' in undefined。运行中最稳的做法是只传最稳的几个字段。
      api.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: detectInitialTheme(),
      })
      return api
    })()
  }
  return mermaidPromise
}

/**
 * 测试 / 兼容探测：jsdom 下 mermaid 会 fetch 一些资源且 svg 不显示。
 */
export function canRenderMermaid(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  if (/jsdom/i.test(navigator.userAgent ?? '')) return false
  return true
}

function detectInitialTheme(): 'dark' | 'default' {
  if (typeof document === 'undefined') return 'default'
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'dark') return 'dark'
  return 'default'
}

function makeId(): string {
  return `mde-mermaid-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`
}

/**
 * 渲染并替换单个 pre.language-mermaid。返回 ok / fail / skip。
 *
 * 实现细节：
 *   - <pre> 里原本是 `<code>source</code>`；我们清空 <pre> 再塞 svg。
 *   - mermaid.render 要求的 container 必须是 *已挂到 document.body* 的节点；
 *     否则 mermaid 内部 d3 select 失败抛 TypeError。
 *   - 临时 container 在 await 后移除。
 */
export async function renderMermaidBlocks(
  root: HTMLElement,
): Promise<{ ok: number; fail: number; skip: number }> {
  if (!canRenderMermaid()) {
    const count = root.querySelectorAll('pre.language-mermaid > code').length
    return { ok: 0, fail: 0, skip: count }
  }
  const pres = Array.from(
    root.querySelectorAll<HTMLPreElement>('pre.language-mermaid > code'),
  )
  let ok = 0
  let fail = 0
  let skip = 0
  const mermaid = await getMermaid()

  for (const codeEl of pres) {
    const pre = codeEl.parentElement as HTMLPreElement | null
    if (!pre) {
      skip++
      continue
    }
    if (pre.dataset.mermaidState === 'ok') {
      skip++
      continue
    }
    const source = codeEl.textContent ?? ''
    pre.dataset.mermaidState = 'pending'
    // 临时 holder：必须真在 document.body 里
    const holder = document.createElement('div')
    holder.style.position = 'fixed'
    holder.style.left = '-9999px'
    holder.style.top = '0'
    document.body.appendChild(holder)

    const id = makeId()
    try {
      const { svg, bindFunctions } = await mermaid.render(id, source, holder)
      // holder 已含 svg；把 svg 转出，丢进 pre
      const wrapper = document.createElement('div')
      wrapper.innerHTML = svg
      const svgEl = wrapper.firstElementChild
      // 把 svg 放进 pre（替换原 <code>），并标 ok
      while (pre.firstChild) pre.removeChild(pre.firstChild)
      if (svgEl) {
        pre.appendChild(svgEl)
        bindFunctions?.(pre)
      }
      pre.dataset.mermaidState = 'ok'
      ok++
    } catch (err) {
      console.warn('[mermaid] render failed:', err)
      pre.dataset.mermaidState = 'fail'
      fail++
    } finally {
      holder.remove()
    }
  }
  return { ok, fail, skip }
}
