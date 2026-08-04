import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  openMarkdownFile,
  saveMarkdownFile,
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

  function closeTab(path: string) {
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
    tab.savedContent = tab.content
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
    openFile,
    upsertTab,
    closeTab,
    activateTab,
    updateActiveContent,
    saveActive,
    chooseWorkspace,
    refreshTree,
  }
})