import { watch, onScopeDispose, getCurrentScope } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSettingsStore } from '@/stores/settings'

/**
 * 自动保存核心(ql Phase 1 骨架):
 *   - 内容变更后 1500ms 防抖调用 workspace.saveActive()
 *   - settings.autoSaveEnabled === false 时完全不触发
 *   - 仅 Dirty 标签触发;Conflict(自动保存暂停)/ Clean 不触发
 *   - 无路径(untitled)标签跳过
 *
 * 填充阶段再做:指数退避重试、blur 失焦保存、kind=removed 处理。
 */

export const AUTOSAVE_DEBOUNCE_MS = 1500

export interface UseAutoSaveOptions {
  /** 防抖时长,默认 1500ms(测试可注入更短值) */
  debounceMs?: number
}

export function useAutoSave(options: UseAutoSaveOptions = {}) {
  const workspace = useWorkspaceStore()
  const settings = useSettingsStore()
  const debounceMs = options.debounceMs ?? AUTOSAVE_DEBOUNCE_MS
  let timer: ReturnType<typeof setTimeout> | null = null

  function cancelPending() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  /** 内容变更后调用:满足条件则(重置)防抖定时器 */
  function scheduleSave() {
    if (!settings.autoSaveEnabled) return
    const tab = workspace.activeTab
    if (!tab) return
    if (tab.status !== 'dirty') return
    if (!tab.path) return
    cancelPending()
    timer = setTimeout(() => {
      timer = null
      void workspace.saveActive()
    }, debounceMs)
  }

  // 监听标签内容/状态变化。骨架期用 content.length 便宜地近似"内容变了"
  // (等长替换不触发——填充阶段换 hash)。
  const stop = watch(
    () =>
      workspace.tabs
        .map((t) => `${t.path}\u0000${t.content.length}\u0000${t.status}`)
        .join('|'),
    () => scheduleSave(),
  )

  if (getCurrentScope()) {
    onScopeDispose(() => {
      stop()
      cancelPending()
    })
  }

  return { scheduleSave, cancelPending }
}
