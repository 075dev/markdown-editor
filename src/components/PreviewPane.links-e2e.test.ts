/**
 * 文档链接跳转·集成复现测试(bugfix-003)。
 *
 * 与 PreviewPane.links.test.ts 的关键差别——mock 下沉:
 *   - 现有单测 mock fileService.readTextFile,store 的 openFileFromPath
 *     虽走真实代码,但"读盘"语义由 mock 决定,真实 invoke 链路未被覆盖;
 *   - 本文件只 mock @tauri-apps/api/core 的 invoke 桥(read_file 直连
 *     node fs 读真实临时文件,语义对齐 Rust read_to_string),store 与
 *     fileService 全部走真实实现。
 *
 * 覆盖症状:「点击文档链接 → 跳转到空文档」。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => invokeMock(cmd, args),
}))
// watch 系走 @tauri-apps/api/event(依赖 transformCallback 等内部件),
// 与被测链路无关——按 links.test.ts 同惯例 mock;readTextFile 保持真实
vi.mock('@/services/fileService', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    watchFileExternal: () => Promise.resolve(() => {}),
    unwatchFileExternal: () => Promise.resolve(),
  }
})
// 渲染管线与图表服务与本链路无关:html 由测试直接注入受控 <a>
vi.mock('@/markdown/pipeline', () => ({
  renderMarkdown: vi.fn(async (src: string) => `<div>${src}</div>`),
}))
vi.mock('@/services/diagramWindow', () => ({
  canOpenInWindow: () => false,
  openDiagramWindow: vi.fn(),
}))
vi.mock('@/services/mermaid', () => ({
  renderMermaidBlocks: vi.fn(async () => {}),
}))

import { useWorkspaceStore } from '@/stores/workspace'
import PreviewPane from '@/components/PreviewPane.vue'

function forceTauri(on: boolean) {
  if (on) {
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
  } else {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  }
}

let tmpDir = ''

beforeEach(() => {
  setActivePinia(createPinia())
  forceTauri(true)
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdelink-'))
  fs.writeFileSync(path.join(tmpDir, 'index.md'), '# index\n[next](next.md)\n')
  fs.writeFileSync(path.join(tmpDir, 'next.md'), '# next real content\n')
  // invoke 桥:语义对齐 Rust —— read_file = read_to_string(失败 Err 字符串),
  // watch/unwatch/open_external 本测试不关心,直接成功
  invokeMock.mockReset()
  invokeMock.mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
    if (cmd === 'read_file') {
      try {
        return fs.readFileSync(args?.path as string, 'utf8')
      } catch (e) {
        throw `FILE_READ_FAILED: read failed: ${(e as Error).message}`
      }
    }
    if (cmd === 'watch_file' || cmd === 'unwatch_file' || cmd === 'open_external') return null
    throw new Error(`unexpected command: ${cmd}`)
  })
  document.body.innerHTML = ''
})

afterEach(() => {
  forceTauri(false)
  vi.restoreAllMocks()
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
})

async function mountPaneWith(renderedHtml: string, tabPath: string) {
  const { renderMarkdown } = await import('@/markdown/pipeline')
  ;(renderMarkdown as ReturnType<typeof vi.fn>).mockResolvedValue(renderedHtml)
  const ws = useWorkspaceStore()
  ws.upsertTab(tabPath, fs.readFileSync(tabPath, 'utf8'))
  const wrapper = mount(PreviewPane, { attachTo: document.body })
  await nextTick()
  await flushPromises()
  return { wrapper, ws }
}

function clickFirstLink(wrapper: ReturnType<typeof mount>): void {
  const a = wrapper.findAll('a')[0].element as HTMLElement
  a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

describe('文档链接跳转·集成(mock 下沉到 invoke 桥)', () => {
  it('同目录相对链接 next.md → 打开真实文件内容(非空)', async () => {
    const indexPath = path.join(tmpDir, 'index.md')
    const nextPath = path.join(tmpDir, 'next.md')
    const { wrapper, ws } = await mountPaneWith('<p><a href="next.md">next</a></p>', indexPath)

    clickFirstLink(wrapper)
    await flushPromises()

    expect(ws.activeTabPath).toBe(nextPath)
    expect(ws.activeTab?.content).toBe('# next real content\n')
  })

  it('文档链接带锚点 next.md#intro → 仍打开完整文件内容', async () => {
    const indexPath = path.join(tmpDir, 'index.md')
    const nextPath = path.join(tmpDir, 'next.md')
    const { wrapper, ws } = await mountPaneWith(
      '<p><a href="next.md#intro">next</a></p>',
      indexPath,
    )

    clickFirstLink(wrapper)
    await flushPromises()

    expect(ws.activeTabPath).toBe(nextPath)
    expect(ws.activeTab?.content).toBe('# next real content\n')
  })

  it('工作区根相对链接 /next.md → 打开真实文件内容', async () => {
    const indexPath = path.join(tmpDir, 'index.md')
    const nextPath = path.join(tmpDir, 'next.md')
    const { wrapper, ws } = await mountPaneWith('<p><a href="/next.md">next</a></p>', indexPath)
    ws.rootPath = tmpDir

    clickFirstLink(wrapper)
    await flushPromises()

    expect(ws.activeTabPath).toBe(nextPath)
    expect(ws.activeTab?.content).toBe('# next real content\n')
  })

  it('目标不存在 → 错误提示,不开新标签,当前标签内容不变', async () => {
    const indexPath = path.join(tmpDir, 'index.md')
    const { wrapper, ws } = await mountPaneWith('<p><a href="ghost.md">ghost</a></p>', indexPath)

    clickFirstLink(wrapper)
    await flushPromises()

    expect(ws.activeTabPath).toBe(indexPath)
    expect(ws.tabs.some((t) => t.path.includes('ghost'))).toBe(false)
    expect(ws.saveNotice?.level).toBe('error')
  })

  it('目标已打开且有未保存修改 → 跳转保留未保存内容并进冲突安全网(不覆盖)', async () => {
    // bugfix-003:自动保存默认关闭,"目标文件写了内容未保存"是常态;
    // 点击指向它的链接曾把未保存内容静默覆盖为磁盘版本(目标为空文件时
    // 呈现为「跳转到空文档」)。期望:进冲突决策,内容保留。
    const indexPath = path.join(tmpDir, 'index.md')
    const nextPath = path.join(tmpDir, 'next.md')
    const { wrapper, ws } = await mountPaneWith('<p><a href="next.md">next</a></p>', indexPath)

    ws.upsertTab(nextPath, '磁盘版本')
    ws.activeTabPath = nextPath
    ws.updateActiveContent('未保存的宝贵修改')
    ws.activeTabPath = indexPath

    clickFirstLink(wrapper)
    await flushPromises()

    const tab = ws.tabs.find((t) => t.path === nextPath)
    expect(tab?.content).toBe('未保存的宝贵修改')
    expect(tab?.status).toBe('conflict')
    expect(tab?.conflictKind).toBe('modified')
    expect(ws.activeTabPath).toBe(nextPath)
  })

  it('目标已打开且 clean → 跳转刷新为磁盘内容(现状保持,防过度修复)', async () => {
    const indexPath = path.join(tmpDir, 'index.md')
    const nextPath = path.join(tmpDir, 'next.md')
    const { wrapper, ws } = await mountPaneWith('<p><a href="next.md">next</a></p>', indexPath)

    ws.upsertTab(nextPath, '过期的 clean 副本')
    ws.activeTabPath = indexPath

    clickFirstLink(wrapper)
    await flushPromises()

    const tab = ws.tabs.find((t) => t.path === nextPath)
    expect(tab?.content).toBe('# next real content\n')
    expect(tab?.status).toBe('clean')
    expect(ws.activeTabPath).toBe(nextPath)
  })
})
