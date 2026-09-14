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
  readTextFile as readTextFileRaw,
  type DirEntry,
} from '@/services/fileService'

export interface OpenTab {
  path: string
  name: string
  content: string
  savedContent: string
}

export const FILE_EXTERNAL_CHANGE_EVENT = 'mde:file-external-change'

/**
 * 文件树节点：在 DirEntry 基础上多了 children/expanded/loading 三个
 * 状态。我们不在 store 初始化时一次性递归所有层级，
 * 而是在用户展开目录时才去拉子节点——这跟主流编辑器（VSCode、IDEA）的
 * 行为一致，对大工程也稳定。
 */
export interface TreeNode extends DirEntry {
  /** 子节点（仅目录有效；初次为 null，等 expandNode 拉取后填充） */
  children: TreeNode[] | null
  /** 子节点是否正在加载 */
  loading: boolean
  /** 当前目录是否已展开（UI 状态） */
  expanded: boolean
}

/**
 * 把 listDirectory 的扁平 DirEntry[] 包成 TreeNode[]：
 *   - 目录节点 children=null（懒加载）
 *   - 文件节点 children=[]（永远不会再展开，约定空数组）
 *   - 排序：目录在前、文件在后，名字按字母升序
 */
function entriesToTreeNodes(entries: DirEntry[]): TreeNode[] {
  const sorted = [...entries].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
  return sorted.map((entry) => ({
    ...entry,
    children: entry.isDir ? null : [],
    loading: false,
    expanded: false,
  }))
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const rootPath = ref<string | null>(null)
  const tree = ref<TreeNode[]>([])
  /**
   * 缓存已经加载过 children 的目录路径 → 子节点。
   * 这样离开再回到该目录时不用再次打文件系统。
   * key 是目录绝对路径（与 TreeNode.path 同样形态）。
   */
  const treeChildrenCache = new Map<string, TreeNode[]>()
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
    // 切换工作区时清掉旧缓存——避免新旧根路径的 children 错位。
    treeChildrenCache.clear()
    await refreshTree()
  }

  async function refreshTree() {
    if (!rootPath.value) {
      tree.value = []
      return
    }
    const entries = await listDirectory(rootPath.value)
    tree.value = entriesToTreeNodes(entries)
  }

  /**
   * 在已有 tree 里按 path 找到节点；找不到返回 null。
   * 路径用 TreeNode.path 与节点 path 等同（已经在 listDirectory 时拼好）。
   */
  function findNode(nodes: TreeNode[], path: string): TreeNode | null {
    for (const node of nodes) {
      if (node.path === path) return node
      if (node.children) {
        const hit = findNode(node.children, path)
        if (hit) return hit
      }
    }
    return null
  }

  /**
   * 点目录节点：首次点展开，再次点折叠。展开时懒加载子节点。
   */
  async function toggleNode(path: string): Promise<void> {
    const node = findNode(tree.value, path)
    if (!node || !node.isDir) return
    if (node.expanded) {
      node.expanded = false
      return
    }
    node.expanded = true
    if (node.children !== null) return
    // children === null ⇒ 首次展开，拉子目录
    node.loading = true
    try {
      const cached = treeChildrenCache.get(path)
      const entries = cached ?? (await listDirectory(path))
      if (!cached) treeChildrenCache.set(path, entriesToTreeNodes(entries))
      node.children = entriesToTreeNodes(entries)
    } catch (err) {
      console.warn('[workspace] expandNode failed:', err)
      node.children = []
      node.expanded = false
    } finally {
      node.loading = false
    }
  }

  /**
   * 点文件节点：读取内容并打开为标签。
   * markdown 扩展名由调用方决定（这里对所有文本类都允许，简单一些）。
   */
  async function openFileFromPath(path: string): Promise<boolean> {
    const content = await readTextFileRaw(path)
    if (content === null) return false
    upsertTab(path, content)
    return true
  }

  /** 是否是 markdown 文件（用于决定要不要拦截 openFileFromPath） */
  function isMarkdownPath(path: string): boolean {
    return /\.(md|markdown|mdx)$/i.test(path)
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
    toggleNode,
    openFileFromPath,
    isMarkdownPath,
  }
})