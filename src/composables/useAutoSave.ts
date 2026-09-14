import { watch, onScopeDispose, getCurrentScope } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSettingsStore } from '@/stores/settings'
import type { QlErrorCode } from '@/services/errors'

/**
 * 自动保存核心(ql Phase 1 填充态,对照 event-flow.md):
 *   - 内容变更后 1500ms 防抖写盘;内容变化用 FNV-1a hash 检出(等长替换也触发)
 *   - 窗口 blur:取消防抖,立即顺序保存全部 Dirty 标签;失败者走重试链
 *   - 写盘失败指数退避重试 1s/2s/4s 共 3 次,仅对可重试错误码;
 *     用尽后保持 Dirty + error 通知,下次编辑或失焦重新触发
 *   - settings.autoSaveEnabled === false 时防抖/blur/重试全部停用(冲突安全网不受影响)
 *   - Conflict(自动保存暂停)/ Clean / 无路径(untitled)标签不触发
 */

export const AUTOSAVE_DEBOUNCE_MS = 1500
/** 指数退避重试间隔(共 3 次) */
export const AUTOSAVE_RETRY_DELAYS_MS: readonly number[] = [1000, 2000, 4000]
/** 可重试错误码:磁盘写/读失败(只读、被占用等瞬态);其余(如 PATH_INVALID)不重试 */
const RETRYABLE_CODES: QlErrorCode[] = ['FILE_WRITE_FAILED', 'FILE_READ_FAILED']
/** 重试恢复后的 info 通知可见时长 */
const RECOVERY_NOTICE_MS = 3000

export interface UseAutoSaveOptions {
  /** 防抖时长,默认 1500ms(测试可注入更短值) */
  debounceMs?: number
}

/** FNV-1a 32 位轻量内容指纹:等长替换也能检出变化(交接备注 #4) */
export function hashContent(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function useAutoSave(options: UseAutoSaveOptions = {}) {
  const workspace = useWorkspaceStore()
  const settings = useSettingsStore()
  const debounceMs = options.debounceMs ?? AUTOSAVE_DEBOUNCE_MS
  let timer: ReturnType<typeof setTimeout> | null = null
  let retryTimers: ReturnType<typeof setTimeout>[] = []
  let recoveryTimer: ReturnType<typeof setTimeout> | null = null

  function cancelPending() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function clearRetries() {
    retryTimers.forEach((t) => clearTimeout(t))
    retryTimers = []
  }

  function clearRecoveryTimer() {
    if (recoveryTimer !== null) {
      clearTimeout(recoveryTimer)
      recoveryTimer = null
    }
  }

  function isRetryable(): boolean {
    const err = workspace.lastSaveError
    return !!err && RETRYABLE_CODES.includes(err.code)
  }

  function showRecoveryNotice() {
    workspace.saveNotice = { level: 'info', message: '自动保存已恢复' }
    clearRecoveryTimer()
    recoveryTimer = setTimeout(() => {
      // 仅当仍是这条 info 时清除,避免误删新的 error 通知
      if (workspace.saveNotice?.level === 'info') workspace.saveNotice = null
      recoveryTimer = null
    }, RECOVERY_NOTICE_MS)
  }

  /**
   * 一轮重试:顺序落盘所有仍 Dirty 的目标标签。
   * 已被其他路径保存/关闭的条目自动跳过(saveTab 幂等);返回仍失败者。
   */
  async function retryRound(paths: string[]): Promise<string[]> {
    const failed: string[] = []
    let nonRetryable = false
    for (const p of paths) {
      const tab = workspace.tabs.find((t) => t.path === p)
      if (!tab || tab.status !== 'dirty' || !tab.path) continue
      const ok = await workspace.saveTabByPath(p)
      if (!ok) {
        if (isRetryable()) failed.push(p)
        else nonRetryable = true
      }
    }
    if (failed.length === 0 && !nonRetryable) showRecoveryNotice()
    return failed
  }

  /**
   * 重试链:delays 1s/2s/4s;用尽后保持 Dirty + error 通知,停止本轮,
   * 下次编辑或失焦重新触发(event-flow 场景 3)。
   */
  function scheduleRetryChain(paths: string[], attempt: number) {
    clearRetries()
    if (attempt >= AUTOSAVE_RETRY_DELAYS_MS.length) {
      workspace.saveNotice = {
        level: 'error',
        message: '自动保存失败:已停止本轮重试,未保存内容已保留;继续编辑或窗口失焦将重新尝试',
      }
      return
    }
    const t = setTimeout(() => {
      retryTimers = retryTimers.filter((x) => x !== t)
      void retryRound(paths).then((failed) => {
        if (failed.length > 0) scheduleRetryChain(failed, attempt + 1)
      })
    }, AUTOSAVE_RETRY_DELAYS_MS[attempt])
    retryTimers.push(t)
  }

  /** 防抖到点的一轮主动保存(当前活动标签) */
  async function runAutoSaveRound() {
    const tab = workspace.activeTab
    if (!tab || tab.status !== 'dirty' || !tab.path) return
    const path = tab.path
    const ok = await workspace.saveActive()
    if (ok) return
    if (isRetryable()) scheduleRetryChain([path], 0)
    // 不可重试:saveTab 已写 error 通知;保持 Dirty,下次编辑/失焦重触发
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
      void runAutoSaveRound()
    }, debounceMs)
  }

  /**
   * 窗口失焦:取消防抖定时器,立即顺序保存全部 Dirty 标签(互不阻断),
   * 可重试失败者进入重试链。开关关闭时整体停用(边缘场景 9)。
   */
  async function onBlur() {
    if (!settings.autoSaveEnabled) return
    cancelPending()
    clearRetries()
    const dirtyPaths = workspace.tabs
      .filter((t) => t.status === 'dirty' && t.path)
      .map((t) => t.path)
    if (dirtyPaths.length === 0) return
    const failed: string[] = []
    for (const p of dirtyPaths) {
      const ok = await workspace.saveTabByPath(p)
      if (!ok && isRetryable()) failed.push(p)
    }
    if (failed.length > 0) scheduleRetryChain(failed, 0)
  }

  // 监听标签内容/状态变化:hash 指纹替代骨架期 content.length 近似(交接备注 #4)
  const stop = watch(
    () =>
      workspace.tabs
        .map((t) => `${t.path}\u0000${hashContent(t.content)}\u0000${t.status}`)
        .join('|'),
    () => scheduleSave(),
  )

  if (typeof window !== 'undefined') {
    window.addEventListener('blur', onBlur)
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      stop()
      cancelPending()
      clearRetries()
      clearRecoveryTimer()
      if (typeof window !== 'undefined') {
        window.removeEventListener('blur', onBlur)
      }
    })
  }

  return { scheduleSave, cancelPending }
}
