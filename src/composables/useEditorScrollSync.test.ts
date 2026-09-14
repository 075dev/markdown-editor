/**
 * 同步滚动工具函数：
 *   - computeRatio: scrollTop / (scrollHeight - clientHeight)，裁 [0,1]，短内容返回 0
 *   - applyRatio: 把 ratio 映射回 scrollTop，短内容钉 0
 *
 * 由于 useEditorScrollSync 本身依赖响应式对象 + DOM 事件，
 * 纯逻辑部分抽出来单测，watch 挂载用 jsdom + fake HTMLElement 走小集成。
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { computeRatio, applyRatio, useEditorScrollSync } from './useEditorScrollSync'

// jsdom 没有 rAF，给一个立刻 flush 的替身。
beforeEach(() => {
  ;(globalThis as unknown as { requestAnimationFrame: (cb: (t: number) => void) => void }).requestAnimationFrame =
    (cb: (t: number) => void) => {
      cb(0)
      return 0
    }
})

interface FakeEl {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  listeners: Record<string, ((e: Event) => void)[]>
  dispatch(type: string, e?: Event): void
  addEventListener(type: string, fn: (e: Event) => void): void
  removeEventListener(type: string, fn: (e: Event) => void): void
}

function fakeEl(scrollHeight: number, clientHeight: number, top = 0): FakeEl {
  const el: FakeEl = {
    scrollTop: top,
    scrollHeight,
    clientHeight,
    listeners: {},
    dispatch(type: string, e: Event = new Event(type)) {
      el.listeners[type]?.forEach((fn) => fn(e))
    },
    addEventListener(type, fn) {
      el.listeners[type] = el.listeners[type] ?? []
      el.listeners[type].push(fn)
    },
    removeEventListener(type, fn) {
      el.listeners[type] = (el.listeners[type] ?? []).filter((f) => f !== fn)
    },
  }
  // 假装 HTMLElement —— 函数类型不强制
  return el
}

describe('useEditorScrollSync 纯函数', () => {
  it('computeRatio: 0 顶 / 1 底 / 短内容 0', () => {
    const el = fakeEl(1000, 200, 0) as unknown as HTMLElement
    expect(computeRatio(el)).toBe(0)
    const el2 = fakeEl(1000, 200, 800) as unknown as HTMLElement
    expect(computeRatio(el2)).toBe(1)
    const el3 = fakeEl(500, 500, 0) as unknown as HTMLElement
    expect(computeRatio(el3)).toBe(0)
  })

  it('applyRatio: 写入对应的 scrollTop', () => {
    const el = fakeEl(1000, 200) as unknown as HTMLElement
    applyRatio(el, 0.5)
    expect((el as unknown as FakeEl).scrollTop).toBe(400)
    applyRatio(el, 0)
    expect((el as unknown as FakeEl).scrollTop).toBe(0)
    applyRatio(el, 1)
    expect((el as unknown as FakeEl).scrollTop).toBe(800)
  })

  it('applyRatio: 短内容钉 0', () => {
    const el = fakeEl(300, 300, 0) as unknown as HTMLElement
    applyRatio(el, 1)
    expect((el as unknown as FakeEl).scrollTop).toBe(0)
  })
})

describe('useEditorScrollSync 集成（watch + 事件）', () => {
  it('editor 滚动 → preview 按相同比例滚动；preview 滚动 → editor 反向', async () => {
    const editor = fakeEl(2000, 200, 0)
    const preview = fakeEl(1500, 200, 0)
    useEditorScrollSync({
      enabled: ref(true),
      editorEl: ref(editor as unknown as HTMLElement),
      previewEl: ref(preview as unknown as HTMLElement),
    })
    // 触发 editor scroll 到中间
    editor.scrollTop = 900 // ratio = (900) / (2000-200)= 0.5
    editor.dispatch('scroll')
    // preview 应该被 applyRatio 到 0.5 → 0.5 * (1500-200) = 650
    expect(preview.scrollTop).toBe(650)
    // 反向：preview 滚
    preview.scrollTop = 1300 // ratio = 1
    preview.dispatch('scroll')
    expect(editor.scrollTop).toBe(1800) // 1 * (2000-200)
  })

  it('enabled = false 时不让预览跟随', async () => {
    const editor = fakeEl(2000, 200, 0)
    const preview = fakeEl(1500, 200, 0)
    useEditorScrollSync({
      enabled: ref(false),
      editorEl: ref(editor as unknown as HTMLElement),
      previewEl: ref(preview as unknown as HTMLElement),
    })
    editor.scrollTop = 900
    editor.dispatch('scroll')
    expect(preview.scrollTop).toBe(0)
  })

  it('禁用时：listener 被取消（防止残留）', async () => {
    const editor = fakeEl(2000, 200, 0)
    const preview = fakeEl(1500, 200, 0)
    const editorEl = ref<HTMLElement | null>(editor as unknown as HTMLElement)
    const previewEl = ref<HTMLElement | null>(preview as unknown as HTMLElement)
    useEditorScrollSync({ enabled: ref(true), editorEl, previewEl })
    await nextTick()

    // 计数
    expect(editor.listeners.scroll?.length ?? 0).toBe(1)
    expect(preview.listeners.scroll?.length ?? 0).toBe(1)

    // 把 editor 引用换掉，应该把旧 listener 移除
    const newEditor = fakeEl(2000, 200, 0)
    editorEl.value = newEditor as unknown as HTMLElement
    await nextTick()
    expect(editor.listeners.scroll?.length ?? 0).toBe(0)
    expect(newEditor.listeners.scroll?.length ?? 0).toBe(1)
  })
})
