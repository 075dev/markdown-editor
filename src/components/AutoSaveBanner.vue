<script setup lang="ts">
import { computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'

/**
 * 冲突提示横幅(event-flow.md 冲突安全网):
 * 任一标签处于 Conflict 时显示,提供双按钮决策。
 * 仅消费 workspace store,不直接触碰 Tauri API(宪法 C1)。
 */
const workspace = useWorkspaceStore()

const conflictTab = computed(
  () => workspace.tabs.find((t) => t.status === 'conflict') ?? null,
)

function keepMine() {
  void workspace.resolveConflictKeepMine()
}

function useDisk() {
  workspace.resolveConflictUseDisk()
}
</script>

<template>
  <div
    v-if="conflictTab"
    class="autosave-banner"
    role="alert"
    data-testid="autosave-banner"
  >
    <span class="autosave-banner__text">
      「{{ conflictTab.name }}」已被外部修改,自动保存已暂停
    </span>
    <div class="autosave-banner__actions">
      <button
        type="button"
        class="autosave-banner__btn autosave-banner__btn--primary"
        data-testid="banner-keep-mine"
        @click="keepMine"
      >
        保留我的
      </button>
      <button
        type="button"
        class="autosave-banner__btn"
        data-testid="banner-use-disk"
        @click="useDisk"
      >
        用磁盘版本
      </button>
    </div>
  </div>
</template>

<style scoped>
.autosave-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 16px;
  background: var(--danger, #b91c1c);
  color: #fff;
  font-size: 13px;
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
</style>
