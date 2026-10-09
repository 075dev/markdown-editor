# Wave 2 / T2-fill:自动保存完整行为 + 冲突安全网

- 分支:ql/wave2-t2-fill(基于 Wave 1 合并后 8eea2eb)→ 提交 89cb132 → merge 7714952
- 严格度:HEAVY(状态机 + 并发时序 + 磁盘 IO 失败路径)
- 执行:worktree wt-t2-fill 隔离 + node_modules junction(降级顺序执行)

## 文件边界(实测 diff 一致,6/6)
- 修改:src/stores/workspace.ts、src/composables/useAutoSave.ts、src/composables/useAutoSave.test.ts、src/components/AutoSaveBanner.vue、src/stores/workspace.watch.test.ts
- 新建:src/components/AutoSaveBanner.test.ts

## 实现内容(对照 event-flow.md 边缘场景表)
1. 指数退避重试(AUTOSAVE_RETRY_DELAYS_MS=1s/2s/4s,共 3 次):仅 FILE_WRITE_FAILED/FILE_READ_FAILED 可重试;用尽保持 Dirty + error 通知停止本轮,下次编辑/失焦重触发;成功发 info「已恢复」(3s 自清)
2. blur 失焦保存:取消防抖,顺序保存全部 Dirty 标签,互不阻断,失败者进重试链;开关关闭时停用
3. kind=removed:Clean/Dirty 一律进 Conflict(conflictKind='removed'),不走重载;OpenTab 新增 conflictKind 字段,Banner 文案区分修改/删除
4. untitled(无 path):防抖与 blur 均跳过(saveTab 短路 + saveAllDirty 过滤)
5. content.length 近似 → FNV-1a 32 位 hash(hashContent,等长替换可检出)
6. conflict 态关闭:closeTab=false 走确认路径 + forceCloseTab 显式丢弃(测试锁定)
7. 冲突安全网独立于 autoSaveEnabled 开关(测试锁定)
8. workspace 落盘统一化:saveTab/saveTabByPath/saveAllDirty;捕获 QlError 写 lastSaveError(重试判别)+ saveNotice(状态条);resolveConflictKeepMine/saveAsActive 同款保护,决策清空 conflictKind

## Interfaces
- Consumes(来自 Wave 1):QlError/normalizeError/withFallbackCode;saveMarkdownFile 失败抛 QlError、取消返 null 的判别面
- Produces:workspace.lastSaveError/saveNotice/dismissSaveNotice/saveTabByPath/saveAllDirty;hashContent/AUTOSAVE_RETRY_DELAYS_MS(可复用导出)

## DoD 检查单
- [x] worktree vue-tsc 0 错;vitest 全量 201/201(34 既有 + 28 新增)
- [x] diff 全在边界内;无 console.log/TODO/mock 残留(边界文件 grep 干净)
- [x] 交接备注 #1(单 pinia + 手动重置)与 #2(fake timers 微任务冲刷)已遵守(用例内 advanceTimersByTimeAsync)
- [x] 原子提交(中文 conventional);合并前实测 diff 与声明一致
