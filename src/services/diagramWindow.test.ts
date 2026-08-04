import { describe, expect, it } from 'vitest'
import { canOpenInWindow, openDiagramWindow } from '@/services/diagramWindow'

describe('diagramWindow', () => {
  it('canOpenInWindow returns false in Web (jsdom) environment', () => {
    // jsdom 不注入 __TAURI_INTERNALS__，所以应该返回 false
    expect(canOpenInWindow()).toBe(false)
  })

  it('openDiagramWindow returns false outside Tauri without throwing', async () => {
    const result = await openDiagramWindow({
      url: 'https://www.plantuml.com/plantuml/svg/xxx',
      title: 'test',
    })
    expect(result).toBe(false)
  })
})