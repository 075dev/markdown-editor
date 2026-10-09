/**
 * 语法速查浮层的全局开关状态(add-006)。
 *
 * 设计要点(沿用 useContextMenu 的模块级单例惯例):
 *   - 单实例:整个应用共享一个浮层,HomeView 挂一次 <SyntaxCheatsheetModal/>。
 *   - 状态不入 settings、不做持久化:速查是纯临时 UI,重启后无需记忆。
 *   - 焦点归还:openSheet 时记录触发元素(缺省取 document.activeElement),
 *     closeSheet 时把焦点还回去,满足键盘可达性要求(Esc 关闭后回到原位)。
 */

import { readonly, ref, type Ref } from 'vue'

/** 浮层打开时的触发元素;关闭时焦点归还给它。 */
let triggerElement: HTMLElement | null = null

const openState = ref(false)

/** 从候选里解析出可聚焦的 HTMLElement;非元素(如 document)返回 null。 */
function pickTrigger(candidate?: EventTarget | null): HTMLElement | null {
  if (candidate instanceof HTMLElement) return candidate
  const active = document.activeElement
  return active instanceof HTMLElement ? active : null
}

export interface SyntaxCheatsheetApi {
  /** 只读的打开状态。 */
  open: Readonly<Ref<boolean>>
  /** 打开浮层;trigger 缺省时记录当前焦点元素用于归还。 */
  openSheet: (trigger?: EventTarget | null) => void
  /** 关闭浮层并把焦点归还给打开时的触发元素。 */
  closeSheet: () => void
  /** 切换开关(F1 语义)。 */
  toggleSheet: (trigger?: EventTarget | null) => void
}

const api: SyntaxCheatsheetApi = {
  open: readonly(openState),
  openSheet(trigger?: EventTarget | null) {
    if (openState.value) return
    triggerElement = pickTrigger(trigger)
    openState.value = true
  },
  closeSheet() {
    if (!openState.value) return
    openState.value = false
    const el = triggerElement
    triggerElement = null
    // 触发元素可能已随路由/重渲离开文档,此时放弃归还,交给浏览器默认行为
    if (el && document.contains(el)) el.focus()
  },
  toggleSheet(trigger?: EventTarget | null) {
    if (openState.value) api.closeSheet()
    else api.openSheet(trigger)
  },
}

/**
 * 任意位置(组件 setup、HomeView 事件、main.ts 菜单回调)都拿到同一个状态。
 */
export function useSyntaxCheatsheet(): SyntaxCheatsheetApi {
  return api
}
