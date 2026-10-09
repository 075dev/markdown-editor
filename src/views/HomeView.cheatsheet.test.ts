/**
 * HomeView 与语法速查浮层的装配回归(add-006):
 *   - F1 全局 keydown → 浮层开关 toggle(与 Ctrl+S 同层注册);
 *   - F1 分拦不得吞掉 Ctrl 组合键:Ctrl+S 在浮层开关旁路下照常保存;
 *   - 浮层开关为模块级状态,组件卸载不残留。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HomeView from '@/views/HomeView.vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSyntaxCheatsheet } from '@/composables/useSyntaxCheatsheet'
import { saveMarkdownFile } from '@/services/fileService'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/services/fileService', async () => {
  const actual = await vi.importActual<typeof import('@/services/fileService')>(
    '@/services/fileService',
  )
  return {
    ...actual,
    saveMarkdownFile: vi.fn(async (_c: string, path?: string) => ({
      path: path ?? 'm.md',
    })),
    watchFileExternal: vi.fn(async () => null),
    unwatchFileExternal: vi.fn(async () => {}),
    readTextFile: vi.fn(async () => null),
  }
})

const saveMock = vi.mocked(saveMarkdownFile)

beforeEach(() => {
  localStorage.clear()
  saveMock.mockReset()
  saveMock.mockImplementation(async (_c: string, path?: string) => ({
    path: path ?? 'm.md',
  }))
  setActivePinia(createPinia())
  useSyntaxCheatsheet().closeSheet()
  document.body.innerHTML = ''
})

function mountHome() {
  return mount(HomeView, {
    global: {
      stubs: {
        TitleBar: true,
        Sidebar: true,
        EditorPane: true,
        PreviewPane: true,
        AutoSaveBanner: true,
        SyntaxCheatsheetModal: true,
      },
    },
  })
}

function pressF1() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1', cancelable: true }))
}

describe('HomeView 装配语法速查(F1 接线)', () => {
  it('按 F1 打开浮层,再按 F1 关闭(toggle)', async () => {
    const sheet = useSyntaxCheatsheet()
    const wrapper = mountHome()
    expect(sheet.open.value).toBe(false)

    pressF1()
    await wrapper.vm.$nextTick()
    expect(sheet.open.value).toBe(true)

    pressF1()
    await wrapper.vm.$nextTick()
    expect(sheet.open.value).toBe(false)
    wrapper.unmount()
  })

  it('浮层打开时 F1 仍可关闭;Ctrl+S 不受 F1 分支影响照常保存', async () => {
    const sheet = useSyntaxCheatsheet()
    const wrapper = mountHome()
    const ws = useWorkspaceStore()
    ws.upsertTab('/a/demo.md', 'hello')
    // saveTab 幂等短路:干净标签不写盘,先制造 dirty 才能验证保存被调
    ws.updateActiveContent('hello world')

    pressF1()
    await wrapper.vm.$nextTick()
    expect(sheet.open.value).toBe(true)

    // Ctrl+S 走原有分支:保存被调,且不触碰浮层状态
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true }),
    )
    await flushPromises()
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(sheet.open.value).toBe(true)

    // 浮层开着时 F1 仍能关闭(浮层只拦截 F1/Esc/Tab,其余快捷键行为不变)
    pressF1()
    await wrapper.vm.$nextTick()
    expect(sheet.open.value).toBe(false)
    wrapper.unmount()
  })
})
