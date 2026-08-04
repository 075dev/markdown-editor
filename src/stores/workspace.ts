import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import {
  openMarkdownFile,
  saveMarkdownFile,
  createNewFile,
  pickWorkspaceDirectory,
  listDirectory,
  watchFileExternal,
  unwatchFileExternal,
  type DirEntry,
} from '@/services/fileService'

export interface OpenTab {
  path: string
  name: string
  content: string
  savedContent: string
}

/**
 * 全局事件名：后端 Tauri 'file-external-change' 转发到浏览器后，
 * fileService 会派发 CustomEvent('mde:file-external-change')。
 * 任何组件都可以监听。
 */
export const FILE_EXTERNAL_CHANGE_EVENT = 'mde:file-external-change'

export const useWorkspaceStore = defineStore('workspace', () => {
  const rootPath = ref<string | null>(null)
  const tree = ref<DirEntry[]>([])
  const tabs = ref<OpenTab[]>([])
  const activeTabPath = ref<string | null>(null)
  const isDirty = computed(() =>
    tabs.value.some((t) => t.content !== t.savedContent),
  )

  /**
   * 处理外部修改事件：派发 reload-tab 事件给监听器（EditorPane）。
   * 不管当前 tabs 里是否有这个路径，事件都派发；EditorPane 自己判断。
   * Q2 决策：冲突时**外部覆盖**本地未保存修改（简化策略）。
   */
  function reloadFromDisk(path: string) {
    if (typeof window === 'undefined') return
    window.dispatchEvent(
      new CustomEvent('mde:reload-tab', { detail: { path } }),
    )
  }

  /**
   * 给一个文件路径建立后端监听（覆盖之前的）。
   * 监听是单文件粒度——同一时间只盯一个文件，符合 VSCode / MarkText 等
   * 主流编辑器的"focused file watcher"模式。
   */
  async function watchPath(path: string | null) {
    if (!path) {
      await unwatchFileExternal()
      return
    }
    await watchFileExternal(path)
  }

  // active tab 切换时启动对应文件的监听。
  // Q3 决策：监听所有已打开标签 + 当前 active tab 是当前焦点。
  // 这里只盯当前 active，避免 Rust 端过多 watcher。
  // 其他 tab 在 reloadFromDisk 阶段也能命中（因为 fileService 监听的是
  // CustomEvent 全局派发，文件名匹配即触发）。
  if (typeof window !== 'undefined') {
    // watch active tab 变化
    setTimeout(() => {
      // 在 pinia setup 阶段 watch 不一定能拿到 current effect scope，
      // 所以延迟到下一个 tick 启用
      watch(activeTabPath, (next) => {
        void watchPath(next)
      }, { immediate: true })
    }, 0)
  }

  /**
   * 监听全局 CustomEvent，把 file-external-change 路由到 reloadFromDisk
   * （fileService 派发的 CustomEvent name 与本常量一致）
   */
  if (typeof window !== 'undefined') {
    window.addEventListener(FILE_EXTERNAL_CHANGE_EVENT, ((
      e: Event,
    ) => {
      const detail = (e as CustomEvent<{ path: string }>).detail
      if (detail?.path) reloadFromDisk(detail.path)
    }) as EventListener)
  }

  const activeTab = computed<OpenTab | null>(() => {
    if (!activeTabPath.value) return null
    return tabs.value.find((t) => t.path === activeTabPath.value) ?? null
  })

  async function openFile() {
    const result = await openMarkdownFile()
    if (!result) return
    upsertTab(result.path, result.content)
  }

  function upsertTab(path: string, content: string) {
    const existing = tabs.value.find((t) => t.path === path)
    if (existing) {
      existing.content = content
      existing.savedContent = content
    } else {
      tabs.value.push({
        path,
        name: path.split(/[\\/]/).pop() ?? path,
        content,
        savedContent: content,
      })
    }
    activeTabPath.value = path
  }

  /**
   * 检查标签是否脏（有未保存改动）。
   */
  function isTabDirty(path: string): boolean {
    const tab = tabs.value.find((t) => t.path === path)
    return !!tab && tab.content !== tab.savedContent
  }

  /**
   * 关闭标签。如果标签有未保存改动，返回 false 让上层提示用户；
   * 否则直接关闭并返回 true。
   */
  function closeTab(path: string, opts: { force?: boolean } = {}): boolean {
    const idx = tabs.value.findIndex((t) => t.path === path)
    if (idx === -1) return true
    if (!opts.force && isTabDirty(path)) {
      // 有脏改动：上层应先弹确认（我们不阻塞，而是返回 false 让 UI 处理）
      return false
    }
    tabs.value.splice(idx, 1)
    if (activeTabPath.value === path) {
      activeTabPath.value = tabs.value[0]?.path ?? null
    }
    return true
  }

  /**
   * 强制关闭标签，丢弃未保存改动（用户已确认）。
   */
  function forceCloseTab(path: string) {
    const idx = tabs.value.findIndex((t) => t.path === path)
    if (idx === -1) return
    tabs.value.splice(idx, 1)
    if (activeTabPath.value === path) {
      activeTabPath.value = tabs.value[0]?.path ?? null
    }
  }

  function activateTab(path: string) {
    if (tabs.value.some((t) => t.path === path)) {
      activeTabPath.value = path
    }
  }

  function updateActiveContent(content: string) {
    const tab = activeTab.value
    if (!tab) return
    tab.content = content
  }

  async function saveActive(): Promise<boolean> {
    const tab = activeTab.value
    if (!tab) return false
    const result = await saveMarkdownFile(tab.content, tab.path)
    if (!result) return false
    tab.path = result.path
    tab.name = result.path.split(/[\\/]/).pop() ?? result.path
    tab.savedContent = tab.content
    return true
  }

  /**
   * 另存为：弹保存对话框，让用户选新路径。
   * 与 saveActive 不同：传一个未保存的标签也能成功（不需要现成 path）。
   */
  async function saveAsActive(): Promise<boolean> {
    const tab = activeTab.value
    if (!tab) return false
    const result = await saveMarkdownFile(tab.content, tab.path)
    if (!result) return false
    tab.path = result.path
    tab.name = result.path.split(/[\\/]/).pop() ?? result.path
    tab.savedContent = tab.content
    return true
  }

  /**
   * 新建文件：弹保存对话框让用户选路径，立即落盘并打开新标签。
   */
  async function newFile(): Promise<boolean> {
    const result = await createNewFile({ suggestedName: 'untitled.md' })
    if (!result) return false
    upsertTab(result.path, '')
    return true
  }

  async function chooseWorkspace() {
    const dir = await pickWorkspaceDirectory()
    if (!dir) return
    rootPath.value = dir
    await refreshTree()
  }

  async function refreshTree() {
    if (!rootPath.value) {
      tree.value = []
      return
    }
    tree.value = await listDirectory(rootPath.value)
  }

  return {
    rootPath,
    tree,
    tabs,
    activeTabPath,
    activeTab,
    isDirty,
    isTabDirty,
    openFile,
    newFile,
    upsertTab,
    closeTab,
    forceCloseTab,
    activateTab,
    updateActiveContent,
    saveActive,
    saveAsActive,
    chooseWorkspace,
    refreshTree,
  }
})