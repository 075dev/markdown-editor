<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import ContextMenu from '@/components/ContextMenu.vue'
import { useContextMenu, type MenuItemSpec } from '@/composables/useContextMenu'
import { useWorkspaceStore } from '@/stores/workspace'
import { onStartupOpenFile } from '@/services/startupOpen'

// 把菜单调度入口注入给 main.ts 里的 contextmenu 监听器。
// 同一份 items 序列即可在 main.ts 里决定弹什么、在 ContextMenu.vue 里渲染。
const menu = useContextMenu()
;(window as unknown as { __ctxMenu?: (x: number, y: number, items: MenuItemSpec[]) => void }).__ctxMenu =
  (x, y, items) => menu.show(x, y, items)

const workspace = useWorkspaceStore()

// 暖启动文档打开(bugfix-002):应用已运行时再双击文档,第二实例 argv
// 经 single-instance 插件转发到这里。注册在 App 根,任何路由页都在线。
onMounted(() => {
  void onStartupOpenFile(async (p) => {
    await workspace.openFileFromPath(p)
  })
})
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
