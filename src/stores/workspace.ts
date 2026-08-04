import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  openMarkdownFile,
  saveMarkdownFile,
  createNewFile,
  pickWorkspaceDirectory,
  listDirectory,
  type DirEntry,
} from '@/services/fileService'

export interface OpenTab {
  path: string
  name: string
  content: string
  savedContent: string
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const rootPath = ref<string | null>(null)
  const tree = ref<DirEntry[]>([])
  const tabs = ref<OpenTab[]>([])
  const activeTabPath = ref<string | null>(null)
  const isDirty = computed(() =>
    tabs.value.some((t) => t.content !== t.savedContent),
  )

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