/**
 * kUML 客户端渲染服务测试（add-005）。
 *
 * mock 惯例参照 PreviewPane.links.test.ts：
 *   - vi.mock('@tauri-apps/api/core')（工厂返回闭包，调用期才解引用 mock）；
 *   - 测试内挂 window.__TAURI_INTERNALS__ 强制 Tauri（env.isTauri 判定）；
 *   - canRenderKuml 的 jsdom UA 拦截照抄 mermaid 惯例（jsdom 不渲染）——
 *     需要 Tauri 路径的用例用 defineProperty 临时改写 navigator.userAgent。
 *
 * 每个用例 vi.resetModules() 后动态 import：kuml.ts 的 SVG 缓存是模块级
 * 状态，resetModules 保证用例间互不污染。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const invokeMock = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args: unknown) => invokeMock(cmd, args),
}))

/** 符合 SVG 命名空间的最小干净图 */
const CLEAN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>'

function forceTauri(on: boolean) {
  if (on) {
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
  } else {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  }
}

function allowDesktopUa() {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) kuml-test/1.0',
    configurable: true,
  })
}

function restoreUa() {
  delete (window.navigator as unknown as Record<string, unknown>).userAgent
}

/** 按真实 pipeline 输出形态构造块：<pre><code class="language-kuml">源码</code></pre> */
function mountKumlBlock(source: string, parent: HTMLElement): HTMLPreElement {
  const pre = document.createElement('pre')
  const code = document.createElement('code')
  code.className = 'language-kuml'
  code.textContent = source
  pre.appendChild(code)
  parent.appendChild(pre)
  return pre
}

function freshRoot(): HTMLElement {
  const root = document.createElement('div')
  document.body.appendChild(root)
  return root
}

beforeEach(() => {
  vi.resetModules()
  invokeMock.mockReset()
  invokeMock.mockResolvedValue({ svg: CLEAN_SVG })
  forceTauri(false)
  document.body.innerHTML = ''
})

afterEach(() => {
  forceTauri(false)
  restoreUa()
  vi.restoreAllMocks()
})

describe('renderKumlBlocks', () => {
  it('①渲染成功：清空源码注入 SVG、标 ok、invoke 参数正确', async () => {
    allowDesktopUa()
    forceTauri(true)
    const { renderKumlBlocks } = await import('@/services/kuml')
    const root = freshRoot()
    const pre = mountKumlBlock('Diagram:\n  A -> B', root)

    const result = await renderKumlBlocks(root)

    expect(invokeMock).toHaveBeenCalledTimes(1)
    expect(invokeMock).toHaveBeenCalledWith('render_kuml', { source: 'Diagram:\n  A -> B' })
    expect(result).toEqual({ ok: 1, fail: 0, skip: 0 })
    expect(pre.dataset.kumlState).toBe('ok')
    expect(pre.querySelector('code')).toBeNull()
    expect(pre.querySelector('svg')).not.toBeNull()
    expect(pre.querySelector('circle')).not.toBeNull()
  })

  it('②KUML_NOT_FOUND → not-installed 且源码保留，只 warn 不上抛', async () => {
    allowDesktopUa()
    forceTauri(true)
    invokeMock.mockRejectedValue('KUML_NOT_FOUND: kuml CLI not found in PATH')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { renderKumlBlocks } = await import('@/services/kuml')
    const root = freshRoot()
    const pre = mountKumlBlock('Diagram:\n  A -> B', root)

    const result = await renderKumlBlocks(root)

    expect(result).toEqual({ ok: 0, fail: 1, skip: 0 })
    expect(pre.dataset.kumlState).toBe('not-installed')
    expect(pre.querySelector('code')?.textContent).toBe('Diagram:\n  A -> B')
    expect(warnSpy).toHaveBeenCalled()
  })

  it('③KUML_RENDER_FAILED → fail 且源码保留', async () => {
    allowDesktopUa()
    forceTauri(true)
    invokeMock.mockRejectedValue('KUML_RENDER_FAILED: script error at line 2')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { renderKumlBlocks } = await import('@/services/kuml')
    const root = freshRoot()
    const pre = mountKumlBlock('broken script', root)

    const result = await renderKumlBlocks(root)

    expect(result).toEqual({ ok: 0, fail: 1, skip: 0 })
    expect(pre.dataset.kumlState).toBe('fail')
    expect(pre.querySelector('code')?.textContent).toBe('broken script')
    expect(warnSpy).toHaveBeenCalled()
  })

  it('④非 Tauri → 全部 skipped 计数并标 kumlState=skipped，不 invoke', async () => {
    // 显式 allowDesktopUa：隔离出「仅缺 Tauri」这一变量（否则 UA 也会拦）
    allowDesktopUa()
    forceTauri(false)
    const { renderKumlBlocks } = await import('@/services/kuml')
    const root = freshRoot()
    const pre1 = mountKumlBlock('src one', root)
    const pre2 = mountKumlBlock('src two', root)

    const result = await renderKumlBlocks(root)

    expect(result).toEqual({ ok: 0, fail: 0, skip: 2 })
    expect(invokeMock).not.toHaveBeenCalled()
    expect(pre1.dataset.kumlState).toBe('skipped')
    expect(pre2.dataset.kumlState).toBe('skipped')
  })

  it('⑤同源码两块只 invoke 一次（模块级缓存命中直接注入，跨调用生效）', async () => {
    allowDesktopUa()
    forceTauri(true)
    const { renderKumlBlocks } = await import('@/services/kuml')
    const root = freshRoot()
    const pre1 = mountKumlBlock('same source', root)
    const pre2 = mountKumlBlock('same source', root)

    const first = await renderKumlBlocks(root)

    expect(invokeMock).toHaveBeenCalledTimes(1)
    expect(first).toEqual({ ok: 2, fail: 0, skip: 0 })
    expect(pre1.querySelector('svg')).not.toBeNull()
    expect(pre2.querySelector('svg')).not.toBeNull()

    // 第三块同源码：跨调用也命中缓存，不再 invoke
    const pre3 = mountKumlBlock('same source', root)
    const second = await renderKumlBlocks(root)
    expect(invokeMock).toHaveBeenCalledTimes(1)
    expect(second).toEqual({ ok: 1, fail: 0, skip: 0 })
    expect(pre3.dataset.kumlState).toBe('ok')
    expect(pre3.querySelector('svg')).not.toBeNull()
  })

  it('⑥pending 块跳过：并发第二次调用不重复 invoke', async () => {
    allowDesktopUa()
    forceTauri(true)
    let release!: (value: { svg: string }) => void
    invokeMock.mockImplementation(
      () =>
        new Promise<{ svg: string }>((resolve) => {
          release = resolve
        }),
    )
    const { renderKumlBlocks } = await import('@/services/kuml')
    const root = freshRoot()
    const pre = mountKumlBlock('slow render', root)

    const first = renderKumlBlocks(root)
    // 首块在首个 await 前同步置 pending —— 并发进入的第二次扫描会跳过
    expect(pre.dataset.kumlState).toBe('pending')
    // 等待动态 import + invoke 真正发生（release 由 promise executor 赋值），
    // 再发起并发第二次调用；invoke 未决 → 块仍是 pending → 跳过
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1))
    const second = await renderKumlBlocks(root)
    release({ svg: CLEAN_SVG })
    const firstResult = await first

    expect(invokeMock).toHaveBeenCalledTimes(1)
    expect(firstResult).toEqual({ ok: 1, fail: 0, skip: 0 })
    expect(second).toEqual({ ok: 0, fail: 0, skip: 1 })
    expect(pre.dataset.kumlState).toBe('ok')
  })
})

describe('sanitizeKumlSvg', () => {
  function getSanitize() {
    return import('@/services/kuml').then((m) => m.sanitizeKumlSvg)
  }

  it('干净 SVG 通过并序列化（含 svg 根与内容）', async () => {
    const sanitize = await getSanitize()
    const out = sanitize(CLEAN_SVG)
    expect(out).not.toBeNull()
    expect(out).toContain('<svg')
    expect(out).toContain('circle')
  })

  it('含 <script> → 拒绝（null）', async () => {
    const sanitize = await getSanitize()
    const evil =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="4"/></svg>'
    expect(sanitize(evil)).toBeNull()
  })

  it('含 foreignObject → 拒绝（null）', async () => {
    const sanitize = await getSanitize()
    const evil =
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>x</div></foreignObject></svg>'
    expect(sanitize(evil)).toBeNull()
  })

  it('on* 属性（onload）→ 拒绝（null）', async () => {
    const sanitize = await getSanitize()
    const evil =
      '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4" onload="alert(1)"/></svg>'
    expect(sanitize(evil)).toBeNull()
  })

  it('javascript: href（含大小写变体）→ 拒绝（null）', async () => {
    const sanitize = await getSanitize()
    const evilHref =
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><text>x</text></a></svg>'
    expect(sanitize(evilHref)).toBeNull()
    const evilMixed =
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="JaVaScRiPt:alert(1)"><text>x</text></a></svg>'
    expect(sanitize(evilMixed)).toBeNull()
  })

  it('javascript: xlink:href → 拒绝（null）', async () => {
    const sanitize = await getSanitize()
    const evil =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
      '<a xlink:href="javascript:alert(1)"><text>x</text></a></svg>'
    expect(sanitize(evil)).toBeNull()
  })

  it('scheme 内嵌 tab（java\\tscript:，评审 N1 加固）→ 拒绝（null）', async () => {
    const sanitize = await getSanitize()
    // 浏览器 URL 解析剥离 tab/换行:java\tscript: 在 href 上下文等价 javascript:
    const evilTab =
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="java&#9;script:alert(1)"><text>x</text></a></svg>'
    expect(sanitize(evilTab)).toBeNull()
    const evilNewline =
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="java\nscript:alert(1)"><text>x</text></a></svg>'
    expect(sanitize(evilNewline)).toBeNull()
  })

  it('命名空间前缀 on* / :href 变体（评审 N1 加固）→ 拒绝（null）', async () => {
    const sanitize = await getSanitize()
    const evilPrefixedOn =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:ev="http://www.w3.org/2001/xml-events">' +
      '<circle r="4" ev:onload="alert(1)"/></svg>'
    expect(sanitize(evilPrefixedOn)).toBeNull()
    const evilOtherPrefixHref =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:fake="urn:fake">' +
      '<a fake:href="javascript:alert(1)"><text>x</text></a></svg>'
    expect(sanitize(evilOtherPrefixHref)).toBeNull()
  })

  it('解析失败（非法 XML）→ null', async () => {
    const sanitize = await getSanitize()
    // 标签错配：XML 解析必然失败（jsdom 25 报 parsererror / 抛异常）
    expect(sanitize('<svg xmlns="http://www.w3.org/2000/svg"><circle></svg>')).toBeNull()
    expect(sanitize('not-svg-at-all')).toBeNull()
    expect(sanitize('')).toBeNull()
  })
})
