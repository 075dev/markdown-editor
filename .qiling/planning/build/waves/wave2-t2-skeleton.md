# Wave2 / T2-skeleton:自动保存核心 + 冲突状态机

## 任务卡(摘要)
- 依赖:T1 errors.ts(已合并)+ T3 autoSaveEnabled(已合并)
- 边界:src/stores/workspace.ts、新建 src/composables/useAutoSave.ts + useAutoSave.test.ts、新建 src/components/AutoSaveBanner.vue、src/views/HomeView.vue(仅挂载一处)、src/stores/workspace.watch.test.ts(行为契约变更随改)
- 严格度:HEAVY(新 composable + 状态机 + 定时器语义)
- 验收:worktree 内 vue-tsc 0 错 + useAutoSave/workspace/watch 测试全绿

## 执行记录
- 设计决策:clean→静默重载复用既有 mde:reload-tab 链路(EditorPane 已实现读盘刷新,content/savedContent 同步),EditorPane 不改、不越界;conflict 态继续编辑保持 conflict;isDirty 派生保留兼容
- 实现:TabFileStatus 状态机;handleExternalChange 决策;resolveConflictKeepMine(覆盖写盘→clean)/resolveConflictUseDisk(置 clean + reload 派发);useAutoSave(1500ms 防抖,开关关闭完全不触发,conflict/untitled 跳过);AutoSaveBanner 双按钮;HomeView 挂载
- 修复记录:
  1. mock 参数未用(TS6133)→ _content;watch.test 缺 saveMarkdownFile import
  2. cancelPending 测试时序:Vue watch 异步 flush,fake timers 下需 advanceTimersByTimeAsync(0) 冲微任务后再 cancel
  3. watch.test 多 pinia 泄漏:store 创建时注册 window listener,重复 setActivePinia 留下旧实例 listener 同时响应污染断言 → 改单 pinia beforeAll + 测试间重置 tabs
- worktree 验证:vue-tsc 0 错;vitest useAutoSave+workspace+watch 34/34

## 提交
- feat:cc9631b(6 files, +513/-58)
- merge:bb049df
