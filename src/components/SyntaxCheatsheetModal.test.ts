/**
 * SyntaxCheatsheetModal 行为回归(add-006):
 *   - open 状态驱动渲染(模块级组合式单例,不依赖 props);
 *   - role=dialog + aria-label,打开即聚焦搜索框;
 *   - 搜索:命中 title / 命中 snippet 两种路径 + 空态;
 *   - 复制按钮反馈:writeClipboard ok:true → 「已复制」、ok:false → 「复制失败」,
 *     1.5s 后复位;
 *   - Esc 关闭并归还焦点;Tab 焦点循环锁在浮层内。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import SyntaxCheatsheetModal from '@/components/SyntaxCheatsheetModal.vue'
import { useSyntaxCheatsheet } from '@/composables/useSyntaxCheatsheet'

const writeClipboardMock = vi.fn(async (_text: string) => ({ ok: true }))

vi.mock('@/services/selection', () => ({
  writeClipboard: (text: string) => writeClipboardMock(text),
}))

const sheet = useSyntaxCheatsheet()

beforeEach(() => {
  document.body.innerHTML = ''
  sheet.closeSheet()
  writeClipboardMock.mockReset()
  writeClipboardMock.mockImplementation(async (_text: string) => ({ ok: true }))
})

afterEach(() => {
  vi.useRealTimers()
  sheet.closeSheet()
  document.body.innerHTML = ''
})

/** Teleport 打桩,内容留在 wrapper 内便于查询;浮层需要真实 focus,挂到 body。 */
function mountModal() {
  return mount(SyntaxCheatsheetModal, {
    attachTo: document.body,
    global: { stubs: { teleport: true } },
  })
}

function setSearchKeyword(wrapper: ReturnType<typeof mountModal>, keyword: string) {
  const input = wrapper.find<HTMLInputElement>('[data-testid="cheatsheet-search"]')
  input.element.value = keyword
  input.element.dispatchEvent(new Event('input', { bubbles: true }))
  return nextTick()
}

describe('SyntaxCheatsheetModal', () => {
  it('open 状态驱动渲染:打开出现 dialog,关闭消失', async () => {
    const wrapper = mountModal()
    expect(wrapper.find('[data-testid="cheatsheet-dialog"]').exists()).toBe(false)

    sheet.openSheet()
    await nextTick()
    expect(wrapper.find('[data-testid="cheatsheet-dialog"]').exists()).toBe(true)

    sheet.closeSheet()
    await nextTick()
    expect(wrapper.find('[data-testid="cheatsheet-dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('role=dialog + aria-label=语法速查 + aria-modal', async () => {
    const wrapper = mountModal()
    sheet.openSheet()
    await nextTick()
    const dialog = wrapper.find('[data-testid="cheatsheet-dialog"]')
    expect(dialog.attributes('role')).toBe('dialog')
    expect(dialog.attributes('aria-label')).toBe('语法速查')
    expect(dialog.attributes('aria-modal')).toBe('true')
    wrapper.unmount()
  })

  it('打开即聚焦搜索框', async () => {
    const wrapper = mountModal()
    sheet.openSheet()
    await flushPromises()
    const input = wrapper.find('[data-testid="cheatsheet-search"]').element
    expect(document.activeElement).toBe(input)
    wrapper.unmount()
  })

  it('搜索命中 title:只留命中的节与条目', async () => {
    const wrapper = mountModal()
    sheet.openSheet()
    await nextTick()
    await setSearchKeyword(wrapper, '表格')
    const sections = wrapper.findAll('[data-section-id]')
    expect(sections).toHaveLength(1)
    expect(sections[0].attributes('data-section-id')).toBe('gfm-extended')
    expect(wrapper.find('[data-entry-id="gfm-table"]').exists()).toBe(true)
    expect(wrapper.find('[data-entry-id="md-heading"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('搜索命中 snippet:如 flowchart 只中 mermaid 流程图', async () => {
    const wrapper = mountModal()
    sheet.openSheet()
    await nextTick()
    await setSearchKeyword(wrapper, 'flowchart')
    const sections = wrapper.findAll('[data-section-id]')
    expect(sections).toHaveLength(1)
    expect(sections[0].attributes('data-section-id')).toBe('mermaid')
    expect(wrapper.find('[data-entry-id="mermaid-flowchart"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('无匹配显示「无匹配条目」;清空关键词恢复六节', async () => {
    const wrapper = mountModal()
    sheet.openSheet()
    await nextTick()
    await setSearchKeyword(wrapper, 'zzz绝不存在的关键词xyz')
    expect(wrapper.find('[data-testid="cheatsheet-empty"]').text()).toBe('无匹配条目')
    await setSearchKeyword(wrapper, '')
    expect(wrapper.find('[data-testid="cheatsheet-empty"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-section-id]')).toHaveLength(6)
    wrapper.unmount()
  })

  it('复制成功:writeClipboard 收到 snippet,按钮变「已复制」', async () => {
    const wrapper = mountModal()
    sheet.openSheet()
    await nextTick()
    // 状态更新后 Vue 会替换按钮节点,断言前必须重新 find(不能沿用旧引用)
    await wrapper.find('[data-testid="cheatsheet-copy-md-heading"]').trigger('click')
    await flushPromises()
    expect(writeClipboardMock).toHaveBeenCalledWith('# 一级标题\n## 二级标题\n### 三级标题')
    expect(wrapper.find('[data-testid="cheatsheet-copy-md-heading"]').text()).toBe('已复制')
    wrapper.unmount()
  })

  it('复制成功 1.5s 后按钮复位为「复制」', async () => {
    vi.useFakeTimers()
    const wrapper = mountModal()
    sheet.openSheet()
    await nextTick()
    await wrapper.find('[data-testid="cheatsheet-copy-md-heading"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="cheatsheet-copy-md-heading"]').text()).toBe('已复制')
    await vi.advanceTimersByTimeAsync(1500)
    expect(wrapper.find('[data-testid="cheatsheet-copy-md-heading"]').text()).toBe('复制')
    wrapper.unmount()
  })

  it('复制失败:ok:false 时按钮变「复制失败」', async () => {
    writeClipboardMock.mockImplementation(async () => ({ ok: false, error: 'denied' }))
    const wrapper = mountModal()
    sheet.openSheet()
    await nextTick()
    await wrapper.find('[data-testid="cheatsheet-copy-md-heading"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="cheatsheet-copy-md-heading"]').text()).toBe('复制失败')
    wrapper.unmount()
  })

  it('多个条目的复制反馈互相独立', async () => {
    const wrapper = mountModal()
    sheet.openSheet()
    await nextTick()
    await wrapper.find('[data-testid="cheatsheet-copy-md-bold"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="cheatsheet-copy-md-bold"]').text()).toBe('已复制')
    expect(wrapper.find('[data-testid="cheatsheet-copy-md-italic"]').text()).toBe('复制')
    wrapper.unmount()
  })

  it('Esc 关闭浮层并把焦点归还给打开时的触发元素', async () => {
    const wrapper = mountModal()
    const trigger = document.createElement('button')
    trigger.textContent = '触发按钮'
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    sheet.openSheet()
    await flushPromises()
    // 打开后焦点在搜索框
    expect(document.activeElement).toBe(wrapper.find('[data-testid="cheatsheet-search"]').element)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
    await nextTick()
    expect(sheet.open.value).toBe(false)
    expect(document.activeElement).toBe(trigger)
    wrapper.unmount()
  })

  it('Tab 焦点循环:焦点锁在浮层内(从搜索框 Tab 到关闭按钮)', async () => {
    const wrapper = mountModal()
    sheet.openSheet()
    await flushPromises()
    const search = wrapper.find<HTMLInputElement>('[data-testid="cheatsheet-search"]')
    search.element.focus()
    expect(document.activeElement).toBe(search.element)

    search.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    )
    await nextTick()

    const dialog = wrapper.find('[data-testid="cheatsheet-dialog"]').element
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).toBe(wrapper.find('[data-testid="cheatsheet-close"]').element)
    wrapper.unmount()
  })
})
