import { describe, expect, it } from 'vitest'
import { toFontStack, WEB_FALLBACK_FONTS, DEFAULT_SANS_FONT, DEFAULT_MONO_FONT } from '@/stores/settings'

describe('toFontStack', () => {
  it('wraps plain family names without quotes', () => {
    expect(toFontStack('Inter', 'sans')).toMatch(/^Inter, /)
  })

  it('quotes family names with spaces', () => {
    expect(toFontStack('Helvetica Neue', 'sans')).toMatch(/^"Helvetica Neue", /)
  })

  it('escapes embedded double quotes', () => {
    expect(toFontStack('Bad"Name', 'sans')).toContain('Bad\\"Name')
  })

  it('returns default for empty input (sans)', () => {
    expect(toFontStack('', 'sans')).toBe(DEFAULT_SANS_FONT)
  })

  it('returns default for empty input (mono)', () => {
    expect(toFontStack('   ', 'mono')).toBe(DEFAULT_MONO_FONT)
  })

  it('includes platform fallback stack', () => {
    const stack = toFontStack('Inter', 'sans')
    expect(stack).toContain('system-ui')
    expect(stack).toContain('sans-serif')
  })

  it('uses ui-monospace for mono fallback', () => {
    const stack = toFontStack('JetBrains Mono', 'mono')
    expect(stack).toContain('ui-monospace')
    expect(stack).toContain('monospace')
  })
})

describe('WEB_FALLBACK_FONTS', () => {
  it('contains reasonable defaults', () => {
    expect(WEB_FALLBACK_FONTS.sans.length).toBeGreaterThan(10)
    expect(WEB_FALLBACK_FONTS.mono.length).toBeGreaterThan(8)
    expect(WEB_FALLBACK_FONTS.sans).toContain('Inter')
    expect(WEB_FALLBACK_FONTS.mono).toContain('JetBrains Mono')
  })
})