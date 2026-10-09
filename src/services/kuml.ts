/**
 * kUML（https://kuml.dev，Kotlin DSL 图表语言）客户端渲染 —— add-005。
 *
 * 结构与惯例参照 services/mermaid.ts：
 *   - pipeline（stripDiagramCode）把 ```kuml 围栏扁平化为
 *     <pre><code class="language-kuml">源码</code></pre>，高亮插件不碰它；
 *   - PreviewPane 在客户端扫这些块，调 Rust 命令 `render_kuml` 出 SVG；
 *   - 渲染失败 / CLI 未安装：保留源码块并打 data-kuml-state，不丢内容，
 *     只 console.warn，绝不上抛。
 *
 * 与 mermaid 的差异：
 *   - 渲染在 Rust 侧（invoke('render_kuml', { source }) → { svg }；Err 为
 *     "CODE: message"，code ∈ KUML_NOT_FOUND / KUML_RENDER_FAILED）；
 *   - CLI 冷启动 2-5s → 模块级「源码哈希 → SVG」缓存，命中直接注入不再 invoke；
 *   - invoke 走动态 import('@tauri-apps/api/core')（Web 打包不携带 Tauri API，
 *     mermaid / diagramWindow 同惯例）；
 *   - 该注入路径绕过 rehype-sanitize → 注入前必须过 sanitizeKumlSvg。
 *
 * 注意（与 mermaid 的选择器差异）：pipeline 实际输出里 language-x 类在
 * <code> 上而非 <pre> 上，故扫描用 `pre > code.language-kuml`
 * （对「pre 带类」的旧形态同样兼容；mermaid 的 `pre.language-mermaid > code`
 * 对当前 pipeline 输出命中为空，属既有问题，不在本增量范围内修）。
 */

import { isTauri } from '@/services/env'
import { normalizeError } from '@/services/errors'

export type KumlBlockState = 'pending' | 'ok' | 'fail' | 'not-installed' | 'skipped'

/** 成功渲染结果缓存：源码哈希 → 清洗后的 SVG（冷启动 2-5s，必须缓存） */
const svgCache = new Map<string, string>()

/**
 * Rust 侧 KUML 专属错误码识别。
 * errors.ts 的 QlErrorCode / CODE_PREFIX_RE 先于 add-005 定稿，不含 KUML_*；
 * normalizeError 未命中前缀时保留完整原始 message —— 在 message 上再识别。
 * 只有 KUML_NOT_FOUND（CLI 未装）映射 not-installed，其余一律按 fail 处理。
 */
const KUML_NOT_FOUND_RE = /^KUML_NOT_FOUND:[ \t]?/i

/**
 * 测试 / 兼容探测：非 Tauri 或 jsdom（UA 检测照抄 mermaid.ts 的
 * canRenderMermaid）均不可渲染。
 */
export function canRenderKuml(): boolean {
  if (!isTauri()) return false
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  if (/jsdom/i.test(navigator.userAgent ?? '')) return false
  return true
}

/**
 * FNV-1a（32 位）零依赖哈希；附源码长度进一步降低碰撞面。
 */
function hashSource(source: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${source.length.toString(36)}-${(hash >>> 0).toString(36)}`
}

/**
 * SVG 清洗（零依赖）。必须发生在 innerHTML 注入前 —— 该路径绕过 rehype-sanitize。
 *
 * 规则(任一命中即整体拒绝,返回 null):
 *   - XML 解析出错(parsererror / 抛异常);
 *   - 文档根不是 <svg>;
 *   - 任意节点 tag 名为 script / foreignObject(大小写不敏感);
 *   - 任意属性局部名以 on 开头(含命名空间前缀变体,大小写不敏感);
 *   - 任意 *:href 属性值剥离空白/控制字符后以 javascript: 开头
 *     (浏览器 URL 解析会剥离 tab/换行,java\tscript: 在 href 上下文可执行)。
 *
 * 通过则用 XMLSerializer 序列化 documentElement 返回。
 */
export function sanitizeKumlSvg(svg: string): string | null {
  if (typeof svg !== 'string' || svg.trim() === '') return null
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  } catch {
    return null
  }
  if (doc.getElementsByTagName('parsererror').length > 0) return null
  const rootEl = doc.documentElement
  if (!rootEl || rootEl.nodeName.toLowerCase() !== 'svg') return null
  if (hasUnsafeNode(rootEl)) return null
  return new XMLSerializer().serializeToString(rootEl)
}

function hasUnsafeNode(rootEl: Element): boolean {
  const nodes: Element[] = [rootEl, ...Array.from(rootEl.getElementsByTagName('*'))]
  for (const el of nodes) {
    const tag = el.nodeName.toLowerCase()
    if (tag === 'script' || tag === 'foreignobject') return true
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      // 命名空间前缀属性看局部名:xlink:href 与 href 同判,前缀 on* 同判
      const local = name.includes(':') ? name.slice(name.lastIndexOf(':') + 1) : name
      if (local.startsWith('on')) return true
      if (local === 'href' || local === 'xlink:href' || name.endsWith(':href')) {
        // 浏览器解析 URL 时会剥离 tab/换行等控制字符(java\tscript: 可执行),
        // 判定前先把值里的空白/控制字符剥掉再比对 scheme
        const scheme = attr.value.replace(/[\s\u0000-\u001f]+/g, '').toLowerCase()
        if (scheme.startsWith('javascript:')) return true
      }
    }
  }
  return false
}

/** 把清洗后的 SVG 注入 pre（替换原 <code>），与 mermaid 的 DOM 替换方式一致 */
function injectSvg(pre: HTMLPreElement, svg: string): void {
  const wrapper = document.createElement('div')
  // svg 已过 sanitizeKumlSvg —— 此处 innerHTML 的输入是清洗后的可信输出
  wrapper.innerHTML = svg
  const svgEl = wrapper.firstElementChild
  while (pre.firstChild) pre.removeChild(pre.firstChild)
  if (svgEl) pre.appendChild(svgEl)
}

/**
 * 渲染并替换单个 pre 里的 kUML 源码块。返回 ok / fail / skip 计数。
 *
 *   - 扫 `pre > code.language-kuml`（language 类在 code 上，见文件头说明）；
 *   - pre.dataset.kumlState ∈ pending / ok / fail / not-installed / skipped；
 *   - 已是 ok / pending 的块跳过（不并发重复调 invoke）；
 *   - KUML_NOT_FOUND → 保留源码 + 'not-installed'；其余错误 → 保留源码 + 'fail'；
 *     计数均记入 fail（状态区分由 dataset 承载）；
 *   - 缓存命中直接注入，不 invoke；只缓存清洗通过的 SVG；
 *   - 任何错误只 console.warn，绝不上抛（调用方另有 try/catch 兜底）。
 */
export async function renderKumlBlocks(
  root: HTMLElement,
): Promise<{ ok: number; fail: number; skip: number }> {
  const codeEls = Array.from(root.querySelectorAll<HTMLElement>('pre > code.language-kuml'))

  if (!canRenderKuml()) {
    for (const codeEl of codeEls) {
      const pre = codeEl.parentElement as HTMLPreElement | null
      if (pre) pre.dataset.kumlState = 'skipped'
    }
    return { ok: 0, fail: 0, skip: codeEls.length }
  }

  let ok = 0
  let fail = 0
  let skip = 0
  type InvokeFn = (cmd: string, args: { source: string }) => Promise<{ svg: string }>
  let invokeFn: InvokeFn | null = null

  for (const codeEl of codeEls) {
    const pre = codeEl.parentElement as HTMLPreElement | null
    if (!pre) {
      skip++
      continue
    }
    const state = pre.dataset.kumlState
    if (state === 'ok' || state === 'pending') {
      skip++
      continue
    }

    const source = codeEl.textContent ?? ''
    const cacheKey = hashSource(source)
    const cached = svgCache.get(cacheKey)
    if (cached !== undefined) {
      injectSvg(pre, cached)
      pre.dataset.kumlState = 'ok'
      ok++
      continue
    }

    // 先同步置 pending：并发进入的第二次扫描会因 pending 跳过，防重复 invoke
    pre.dataset.kumlState = 'pending'
    try {
      if (!invokeFn) {
        // 动态 import：Web 打包不携带 Tauri API（mermaid / diagramWindow 同惯例）
        const core = await import('@tauri-apps/api/core')
        invokeFn = core.invoke as unknown as InvokeFn
      }
      const result = await invokeFn('render_kuml', { source })
      // 绕过 rehype-sanitize 的路径：注入前必须清洗；清洗拒绝按渲染失败处理
      const clean = sanitizeKumlSvg(result?.svg ?? '')
      if (clean === null) {
        console.warn('[kuml] svg rejected by sanitizer; keeping source block')
        pre.dataset.kumlState = 'fail'
        fail++
        continue
      }
      svgCache.set(cacheKey, clean)
      injectSvg(pre, clean)
      pre.dataset.kumlState = 'ok'
      ok++
    } catch (err) {
      // Err(String) 形如 "CODE: message"；normalizeError 未命中自身前缀表时
      // 保留完整原始 message，KUML_NOT_FOUND 码在 message 上识别
      const isNotInstalled = KUML_NOT_FOUND_RE.test(normalizeError(err).message)
      pre.dataset.kumlState = isNotInstalled ? 'not-installed' : 'fail'
      console.warn('[kuml] render failed:', err)
      fail++
    }
  }
  return { ok, fail, skip }
}
