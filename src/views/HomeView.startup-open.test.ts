import { expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HomeView from '@/views/HomeView.vue'
import { useWorkspaceStore } from '@/stores/workspace'

/**
 * 装配级复现(bugfix-001):系统以"默认打开方式"启动应用时传入文档
 * 路径,HomeView 应在挂载后取走该路径并打开为标签。
 * 当前实现不存在该链路 —— 本测试以 bug 的方式失败(标签未被打开)。
 */

const STARTUP_PATH = 'D:/notes/demo.md'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/services/startupOpen', () => ({
  takeStartupOpenPath: vi.fn(async () => STARTUP_PATH),
}))

vi.mock('@/services/fileService', async () => {
  const actual = await vi.importActual<typeof import('@/services/fileService')>(
    '@/services/fileService',
  )
  return {
    ...actual,
    readTextFile: vi.fn(async (path: string) => `# hello from ${path}`),
    saveMarkdownFile: vi.fn(async (_c: string, path?: string) => ({ path: path ?? 'm.md' })),
    watchFileExternal: vi.fn(async () => null),
    unwatchFileExternal: vi.fn(async () => {}),
  }
})

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  setActivePinia(createPinia())
})

it('启动路径存在:挂载后自动打开该文件为标签', async () => {
  const wrapper = mount(HomeView)
  await flushPromises()
  const ws = useWorkspaceStore()
  expect(ws.tabs.some((t) => t.path === STARTUP_PATH)).toBe(true)
  expect(ws.activeTabPath).toBe(STARTUP_PATH)
  wrapper.unmount()
})

it('启动路径为 null:不打开任何标签', async () => {
  const { takeStartupOpenPath } = await import('@/services/startupOpen')
  vi.mocked(takeStartupOpenPath).mockResolvedValue(null)
  const wrapper = mount(HomeView)
  await flushPromises()
  const ws = useWorkspaceStore()
  expect(ws.tabs.length).toBe(0)
  wrapper.unmount()
})
