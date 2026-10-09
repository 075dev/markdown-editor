/**
 * editorClipboard 的纯逻辑部分：copyFromView 走 selection + writeClipboard。
 * 真 CodeMirror view 难在 jsdom 起，我们用 minimal mock 测：
 * 1. 空选区 → 返回 false
 * 2. 非空选区 → 调 writeClipboard 把 sliceDoc 结果写入
 */
import { describe, expect, it, vi } from 'vitest'
import { copyFromView } from '@/services/editorClipboard'

interface MockState {
  sliceDoc: (from: number, to: number) => string
  selection: { main: { empty: boolean; from: number; to: number } }
  dispatch: (tr: unknown) => void
}
type MockView = { state: MockState }

function mkView(selFrom: number, selTo: number, docText: string, dispatched: unknown[] = []): MockView {
  // sliceDoc(a, b) 直接走 a/b 索引，不必从 selFrom 偏移
  return {
    state: {
      sliceDoc: (a: number, b: number) => docText.slice(a, b),
      selection: { main: { empty: selFrom === selTo, from: selFrom, to: selTo } },
      dispatch: (tr) => dispatched.push(tr),
    },
  }
}

vi.mock('@/services/selection', () => ({
  writeClipboard: vi.fn(async (text: string) => ({ ok: text.length > 0 })),
  readClipboard: vi.fn(async () => 'PASTED'),
  readSelection: vi.fn(() => ''),
  isEditableTarget: vi.fn(() => false),
}))

import { writeClipboard } from '@/services/selection'
const writeMock = vi.mocked(writeClipboard)

describe('editorClipboard.copyFromView', () => {
  it('returns false on empty selection', async () => {
    writeMock.mockClear()
    const view = mkView(3, 3, '') as never
    const ok = await copyFromView(view as never)
    expect(ok).toBe(false)
    expect(writeMock).not.toHaveBeenCalled()
  })

  it('writes the selected slice to clipboard when non-empty', async () => {
    writeMock.mockClear()
    // 文档："hello world"
    //             012345678901
    // 选中: index 6..11 → "world"
    const doc = 'hello world'
    const view = mkView(6, 11, doc) as never
    const ok = await copyFromView(view as never)
    expect(ok).toBe(true)
    expect(writeMock).toHaveBeenCalledWith('world')
  })
})
