/**
 * 全局自定义右键菜单的 composable。
 *
 * 设计要点：
 *   - 单实例：整个应用共享一个菜单。组件 <ContextMenu/> 由 App.vue 挂一次。
 *   - 状态：open + position + items。items 由调用方传入。
 *   - 关闭：点其他地方、滚动、Esc 都能关闭。
 *   - 点击菜单项后自动关闭。
 */

import { ref, getCurrentInstance, type Ref } from 'vue'

export interface MenuItemSpec {
  /** 唯一 key。 */
  key: string
  /** 显示文本。 */
  label: string
  /** 灰显文案。 */
  disabled?: boolean
  /** 触发后调用。返回值不关心。 */
  onSelect: () => void | Promise<void>
}

export interface ContextMenuApi extends ContextMenuState {
  show: (x: number, y: number, items: MenuItemSpec[]) => void
  hide: () => void
  pick: (item: MenuItemSpec) => void
}

export interface ContextMenuState {
  open: Ref<boolean>
  x: Ref<number>
  y: Ref<number>
  items: Ref<MenuItemSpec[]>
}

let singleton: ContextMenuApi | null = null
let listenersBound = false

function bindGlobalListeners(state: ContextMenuApi) {
  if (listenersBound) return
  listenersBound = true
  function onDocClick(e: MouseEvent) {
    if (!state.open.value) return
    const target = e.target as HTMLElement | null
    if (target && target.closest('.ctx-menu')) return
    state.hide()
  }
  function onScroll() {
    state.hide()
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') state.hide()
  }
  document.addEventListener('click', onDocClick)
  document.addEventListener('scroll', onScroll, true)
  document.addEventListener('keydown', onKey)
}

function ensureSingleton(): ContextMenuApi {
  if (singleton) return singleton
  const open = ref(false)
  const x = ref(0)
  const y = ref(0)
  const items = ref<MenuItemSpec[]>([])

  const api: ContextMenuApi = {
    open,
    x,
    y,
    items,
    show(x: number, y: number, list: MenuItemSpec[]) {
      api.x.value = x
      api.y.value = y
      api.items.value = list
      api.open.value = true
    },
    hide() {
      api.open.value = false
      api.items.value = []
    },
    pick(item: MenuItemSpec) {
      if (item.disabled) return
      api.hide()
      void item.onSelect()
    },
  }
  bindGlobalListeners(api)
  singleton = api
  return api
}

/**
 * 在组件 setup 里调用时，也可在 main.ts / 普通模块顶层调用：
 * 监听器只在第一次调用时绑定一次到 document。Vue 生命周期钩子只在
 * 处于 setup 上下文时才挂上（避免「outside setup」warning）。
 */
export function useContextMenu(): ContextMenuApi {
  const state = ensureSingleton()
  const inst = getCurrentInstance()
  if (inst) {
    // 当前在组件 setup 中；不需要额外生命周期管理，全局监听在第一次 bind 时已经生效。
  }
  return state
}
