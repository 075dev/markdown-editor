import { describe, expect, it, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AutoSaveBanner from '@/components/AutoSaveBanner.vue'
import { useWorkspaceStore, FILE_EXTERNAL_CHANGE_EVENT } from '@/stores/workspace'
import { saveMarkdownFile } from '@/services/fileService'

/**
 * 自动保存状态条(填充阶段 T2):
 *   - Conflict 横幅按 conflictKind 区分文案(modified / removed)
 *   - 双按钮触发对应决策 action
 *   - 无冲突时渲染 saveNotice(保存失败/恢复),error 可手动关闭
 */

vi.mock('@/services/fileService', async () => {
  const actual = await vi.importActual<typeof import('@/services/fileService')>(
    '@/services/fileService',
  )
  return {
    ...actual,
    saveMarkdownFile: vi.fn(async (_c: string, path?: string) => ({ path: path ?? 'm.md' })),
    watchFileExternal: vi.fn(async () => null),
    unwatchFileExternal: vi.fn(async () => {}),
    readTextFile: vi.fn(async () => null),
  }
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(saveMarkdownFile).mockClear()
})

function mountBanner() {
  const ws = useWorkspaceStore()
  const wrapper = mount(AutoSaveBanner)
  return { ws, wrapper }
}

function fireExternal(path: string, kind: 'modified' | 'removed') {
  window.dispatchEvent(
    new CustomEvent(FILE_EXTERNAL_CHANGE_EVENT, { detail: { path, kind } }),
  )
}

describe('AutoSaveBanner', () => {
  it('无冲突无通知时不渲染任何条', () => {
    const { wrapper } = mountBanner()
    expect(wrapper.find('[data-testid="autosave-banner"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="autosave-notice"]').exists()).toBe(false)
  })

  it('modified 冲突:横幅显示「已被外部修改」', async () => {
    const { ws, wrapper } = mountBanner()
    ws.upsertTab('/a/b.md', 'saved')
    ws.updateActiveContent('mine')
    fireExternal('/a/b.md', 'modified')
    await flushPromises()
    const banner = wrapper.find('[data-testid="autosave-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('已被外部修改')
  })

  it('removed 冲突:横幅显示「已在外部被删除」与恢复提示', async () => {
    const { ws, wrapper } = mountBanner()
    ws.upsertTab('/a/gone.md', 'content')
    fireExternal('/a/gone.md', 'removed')
    await flushPromises()
    const banner = wrapper.find('[data-testid="autosave-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('已在外部被删除')
    expect(banner.text()).toContain('重新写盘恢复')
  })

  it('「保留我的」触发 resolveConflictKeepMine(写盘)→ 横幅消失', async () => {
    const { ws, wrapper } = mountBanner()
    ws.upsertTab('/a/b.md', 'disk')
    ws.updateActiveContent('mine')
    fireExternal('/a/b.md', 'modified')
    await flushPromises()
    expect(wrapper.find('[data-testid="autosave-banner"]').exists()).toBe(true)

    await wrapper.find('[data-testid="banner-keep-mine"]').trigger('click')
    await flushPromises()
    expect(saveMarkdownFile).toHaveBeenCalledTimes(1)
    expect(ws.tabs[0].status).toBe('clean')
    expect(wrapper.find('[data-testid="autosave-banner"]').exists()).toBe(false)
  })

  it('「用磁盘版本」触发 resolveConflictUseDisk → 横幅消失', async () => {
    const { ws, wrapper } = mountBanner()
    ws.upsertTab('/a/b.md', 'disk')
    ws.updateActiveContent('mine')
    fireExternal('/a/b.md', 'modified')
    await flushPromises()

    await wrapper.find('[data-testid="banner-use-disk"]').trigger('click')
    await flushPromises()
    expect(ws.tabs[0].status).toBe('clean')
    expect(wrapper.find('[data-testid="autosave-banner"]').exists()).toBe(false)
  })

  it('saveNotice error:渲染通知条,手动关闭后消失', async () => {
    const { ws, wrapper } = mountBanner()
    ws.saveNotice = { level: 'error', message: '保存失败:磁盘只读' }
    await flushPromises()
    const notice = wrapper.find('[data-testid="autosave-notice"]')
    expect(notice.exists()).toBe(true)
    expect(notice.text()).toContain('保存失败:磁盘只读')

    await wrapper.find('[data-testid="notice-dismiss"]').trigger('click')
    await flushPromises()
    expect(ws.saveNotice).toBeNull()
    expect(wrapper.find('[data-testid="autosave-notice"]').exists()).toBe(false)
  })

  it('saveNotice info:渲染恢复通知', async () => {
    const { ws, wrapper } = mountBanner()
    ws.saveNotice = { level: 'info', message: '自动保存已恢复' }
    await flushPromises()
    expect(wrapper.find('[data-testid="autosave-notice"]').text()).toContain('自动保存已恢复')
  })
})
