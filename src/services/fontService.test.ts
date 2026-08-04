import { describe, expect, it, beforeEach } from 'vitest'
import { listSystemFonts, clearFontCache } from '@/services/fontService'
import { isTauri } from '@/services/env'
import { WEB_FALLBACK_FONTS } from '@/stores/settings'

// jsdom 不注入 Tauri 内部 API，listSystemFonts 应直接走 fallback
beforeEach(() => {
  clearFontCache()
})

describe('listSystemFonts (web fallback path)', () => {
  it('returns web fallback list in non-Tauri env', async () => {
    if (isTauri()) {
      // Tauri 环境跳过本测试（真机时会有不同行为）
      return
    }
    const list = await listSystemFonts()
    expect(list.sans.length).toBeGreaterThan(0)
    expect(list.mono.length).toBeGreaterThan(0)
  })

  it('includes the canonical fallback names', async () => {
    if (isTauri()) return
    const list = await listSystemFonts()
    // WEB_FALLBACK_FONTS 的所有项必须被返回（合并去重后仍存在）
    for (const f of WEB_FALLBACK_FONTS.sans) {
      expect(list.sans).toContain(f)
    }
    for (const f of WEB_FALLBACK_FONTS.mono) {
      expect(list.mono).toContain(f)
    }
  })

  it('returns sorted lists (stable ordering for UI dropdowns)', async () => {
    if (isTauri()) return
    const list = await listSystemFonts()
    const sortedSans = [...list.sans].sort()
    const sortedMono = [...list.mono].sort()
    expect(list.sans).toEqual(sortedSans)
    expect(list.mono).toEqual(sortedMono)
  })

  it('clearFontCache + re-call returns same list (deterministic)', async () => {
    if (isTauri()) return
    const a = await listSystemFonts()
    clearFontCache()
    const b = await listSystemFonts()
    expect(a).toEqual(b)
  })
})