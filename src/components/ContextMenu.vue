<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useContextMenu } from '@/composables/useContextMenu'

const menu = useContextMenu()
const root = ref<HTMLUListElement | null>(null)

// 视口边界修正：菜单宽度按 item 数自适配（4–120px），高度约 item*28+8。
// 简化处理：只防右/下溢出。
const adjustedX = computed(() => {
  if (!menu.open.value) return 0
  const w = root.value?.offsetWidth ?? 160
  return Math.min(menu.x.value, window.innerWidth - w - 4)
})
const adjustedY = computed(() => {
  if (!menu.open.value) return 0
  const h = root.value?.offsetHeight ?? 28
  return Math.min(menu.y.value, window.innerHeight - h - 4)
})

/**
 * 关键：菜单打开时**不主动 focus**任何项。
 *
 * 旧实现会在 v-if 渲染后立刻 focus 第一项，结果：
 *   1. 第一项永远 focus → :focus CSS 永远高亮它，看起来像"默认高亮"
 *   2. 鼠标 hover 到其它项时，focus + hover 双层都上色，看起来"两个都高亮"
 *
 * 正确语义：菜单的"高亮"完全由鼠标 hover 主导，键盘只在用户主动按方向键时才介入。
 * 关闭时把可能残留的焦点 blur 掉，免得看不见的焦点让 :focus 颜色留下来。
 */
watch(
  () => menu.open.value,
  async (open) => {
    if (open) {
      // 等 v-if 完成渲染后，如果之前菜单被 blur 过焦点又重新聚焦到一个非菜单元素，
      // 不需要主动做任何事 —— 鼠标会接管。
      await nextTick()
      return
    }
    // 关闭时：blur 当前焦点（如果是菜单项）
    const active = document.activeElement as HTMLElement | null
    if (active && active.closest('.ctx-menu')) active.blur()
  },
)

// 键盘导航：仅在用户主动按 ↓/↑/Enter 时焦点在菜单上才起作用
function onKeydown(e: KeyboardEvent) {
  if (!menu.open.value) return
  const container = root.value
  if (!container) return
  const active = document.activeElement as HTMLElement | null
  // 只有焦点已经在菜单里时，方向键和 Enter 才归我们管
  const inMenu = active && container.contains(active)
  if (!inMenu) return
  const items = Array.from(
    container.querySelectorAll<HTMLLIElement>('li.ctx-menu__item:not(.is-disabled)'),
  )
  if (items.length === 0) return
  const idx = items.findIndex((el) => el === active)
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    items[(idx + 1 + items.length) % items.length]?.focus()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    items[(idx - 1 + items.length) % items.length]?.focus()
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    const item = menu.items.value[idx]
    if (item) menu.pick(item)
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <ul
      v-if="menu.open.value"
      ref="root"
      class="ctx-menu"
      role="menu"
      :style="{ left: adjustedX + 'px', top: adjustedY + 'px' }"
      data-testid="ctx-menu"
    >
      <li
        v-for="item in menu.items.value"
        :key="item.key"
        class="ctx-menu__item"
        :class="{ 'is-disabled': item.disabled }"
        role="menuitem"
        tabindex="-1"
        @click="menu.pick(item)"
        @keydown.enter.stop.prevent="menu.pick(item)"
        @keydown.space.stop.prevent="menu.pick(item)"
      >
        {{ item.label }}
      </li>
    </ul>
  </Teleport>
</template>

<style scoped>
.ctx-menu {
  position: fixed;
  z-index: 9999;
  min-width: 140px;
  padding: 4px;
  margin: 0;
  list-style: none;
  background: var(--bg-elev, #2b2b2b);
  color: var(--fg, #e5e5e5);
  border: 1px solid var(--border, #444);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  font-size: 13px;
  user-select: none;
}

.ctx-menu__item {
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  /* 避免点击后还残留 :focus 视觉 —— 把它移走 */
  outline: none;
}

.ctx-menu__item:hover {
  background: var(--accent, #5a8dee);
  color: #fff;
}

.ctx-menu__item.is-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ctx-menu__item.is-disabled:hover {
  background: transparent;
  color: inherit;
}
</style>

