<script setup lang="ts">
import { RouterView } from 'vue-router'
import ContextMenu from '@/components/ContextMenu.vue'
import { useContextMenu, type MenuItemSpec } from '@/composables/useContextMenu'

// 把菜单调度入口注入给 main.ts 里的 contextmenu 监听器。
// 同一份 items 序列即可在 main.ts 里决定弹什么、在 ContextMenu.vue 里渲染。
const menu = useContextMenu()
;(window as unknown as { __ctxMenu?: (x: number, y: number, items: MenuItemSpec[]) => void }).__ctxMenu =
  (x, y, items) => menu.show(x, y, items)
</script>

<template>
  <div class="app-shell">
    <RouterView />
  </div>
  <ContextMenu />
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}
</style>
