<script setup lang="ts">
/**
 * 递归渲染一个树节点。自身在模板里以 <FolderTreeNode> 出现，
 * 借助 Vue 3 单文件组件「自动以文件名注册」+ 文件名同名即可：
 * FolderTreeNode.vue ⇒ setup 内部可在模板里直接用 <FolderTreeNode>。
 */
import type { TreeNode } from '@/stores/workspace'
import { useWorkspaceStore } from '@/stores/workspace'

const props = defineProps<{ node: TreeNode }>()
const workspace = useWorkspaceStore()

function onClick() {
  if (props.node.isDir) {
    void workspace.toggleNode(props.node.path)
  } else if (workspace.isMarkdownPath(props.node.path)) {
    void workspace.openFileFromPath(props.node.path)
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    onClick()
  }
}
</script>

<template>
  <li
    class="sidebar__node"
    :class="{
      'sidebar__node--dir': node.isDir,
      'sidebar__node--file': !node.isDir,
    }"
    :data-path="node.path"
  >
    <div
      class="sidebar__row"
      role="button"
      tabindex="0"
      @click="onClick"
      @keydown="onKey"
    >
      <span
        v-if="node.isDir"
        class="sidebar__chevron"
        :class="{ 'sidebar__chevron--open': node.expanded }"
        aria-hidden="true"
      >▸</span>
      <span v-else class="sidebar__chevron sidebar__chevron--placeholder"></span>
      <span class="sidebar__icon">{{ node.isDir ? '📁' : '📄' }}</span>
      <span class="sidebar__name">{{ node.name }}</span>
      <span v-if="node.isDir && node.loading" class="sidebar__loading">…</span>
    </div>
    <ul
      v-if="node.isDir && node.expanded && node.children && node.children.length"
      class="sidebar__tree"
    >
      <FolderTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
      />
    </ul>
  </li>
</template>

<style scoped>
.sidebar__node {
  list-style: none;
}

.sidebar__row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px;
  border-radius: calc(var(--radius) - 2px);
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}

.sidebar__row:hover {
  background: var(--bg-elev);
}

.sidebar__row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.sidebar__chevron {
  display: inline-block;
  width: 12px;
  text-align: center;
  color: var(--text-2);
  font-size: 10px;
  transition: transform 0.1s ease;
}

.sidebar__chevron--open {
  transform: rotate(90deg);
}

.sidebar__chevron--placeholder {
  visibility: hidden;
}

.sidebar__icon {
  font-size: 12px;
}

.sidebar__name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar__loading {
  color: var(--text-2);
  font-size: 11px;
}

/* 递归缩进：每层 12px */
.sidebar__tree {
  padding-left: 12px;
}
</style>
