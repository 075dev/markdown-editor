<script setup lang="ts">
import { computed } from 'vue'
import { useWorkspaceStore, type OpenTab } from '@/stores/workspace'

/**
 * 自动保存状态条(ql Phase 1 填充态):
 *   1. 冲突横幅:按「存在 conflict 的标签列表」逐条渲染,每条目的
 *      文案与双按钮都指向各自标签(修复 F3 错位);文案区分
 *      conflictKind(modified=被外部修改 / removed=被外部删除)。
 *   2. 保存通知:无冲突时显示 saveNotice(保存失败/重试恢复),
 *      error 级可手动关闭,info 级由 useAutoSave 定时清除。
 * 仅消费 workspace store,不直接触碰 Tauri API(宪法 C1)。
 */
const workspace = useWorkspaceStore()

/** 修复 F3:渲染全部 conflict 标签,文案与按钮均作用于各自标签,不再错位到 activeTab */
const conflictTabs = computed(() => workspace.tabs.filter((t) => t.status === 'conflict'))

function conflictText(tab: OpenTab): string {
  return tab.conflictKind === 'removed'
    ? `「${tab.name}」已在外部被删除,自动保存已暂停(「保留我的」会重新写盘恢复文件)`
    : `「${tab.name}」已被外部修改,自动保存已暂停`
}

function keepMine(tab: OpenTab) {
  void workspace.resolveConflictKeepMine(tab.path)
}

function useDisk(tab: OpenTab) {
  void workspace.resolveConflictUseDisk(tab.path)
}

function dismissNotice() {
  workspace.dismissSaveNotice()
}
</script>

<template>
  <div
    v-if="conflictTabs.length > 0"
    class="autosave-banner"
    role="alert"
    data-testid="autosave-banner"
  >
    <div
      v-for="tab in conflictTabs"
      :key="tab.path"
      class="autosave-banner__row"
    >
      <span class="autosave-banner__text">{{ conflictText(tab) }}</span>
      <div class="autosave-banner__actions">
        <button
          type="button"
          class="autosave-banner__btn autosave-banner__btn--primary"
          data-testid="banner-keep-mine"
          @click="keepMine(tab)"
        >
          保留我的
        </button>
        <button
          type="button"
          class="autosave-banner__btn"
          data-testid="banner-use-disk"
          @click="useDisk(tab)"
        >
          用磁盘版本
        </button>
      </div>
    </div>
  </div>
  <div
    v-else-if="workspace.saveNotice"
    class="autosave-notice"
    :class="
      workspace.saveNotice.level === 'error'
        ? 'autosave-notice--error'
        : 'autosave-notice--info'
    "
    :role="workspace.saveNotice.level === 'error' ? 'alert' : 'status'"
    data-testid="autosave-notice"
  >
    <span class="autosave-notice__text">{{ workspace.saveNotice.message }}</span>
    <button
      type="button"
      class="autosave-notice__close"
      data-testid="notice-dismiss"
      aria-label="关闭通知"
      @click="dismissNotice"
    >
      ✕
    </button>
  </div>
</template>

<style scoped>
.autosave-banner {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 16px;
  background: var(--danger, #b91c1c);
  color: #fff;
  font-size: 13px;
}

.autosave-banner__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.autosave-banner__actions {
  display: flex;
  gap: 8px;
}

.autosave-banner__btn {
  font: inherit;
  font-size: 12px;
  padding: 4px 12px;
  background: transparent;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  cursor: pointer;
}

.autosave-banner__btn--primary {
  background: rgba(255, 255, 255, 0.15);
}

.autosave-banner__btn:hover {
  border-color: #fff;
}

.autosave-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 16px;
  font-size: 12px;
  color: #fff;
}

.autosave-notice--error {
  background: var(--danger, #b91c1c);
}

.autosave-notice--info {
  background: var(--ok, #15803d);
}

.autosave-notice__close {
  font: inherit;
  font-size: 12px;
  padding: 2px 8px;
  background: transparent;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  cursor: pointer;
}
</style>
