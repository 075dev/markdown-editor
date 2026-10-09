# Wave 1 / T1-fill:错误规范化全通道

- 分支:ql/wave1-t1-fill(基于 ql/phase-1-autosave @ e0659c9 前基线 ae7f577)
- 提交:367a0a0 → merge e0659c9
- 严格度:HEAVY(错误通道契约化,自动保存重试判别依赖)
- 执行:降级顺序执行(无子智能体工具面),worktree wt-t1-fill 隔离 + node_modules junction

## 文件边界(实测 diff 一致)
- 修改:src/services/fileService.ts、src/services/errors.ts、src/services/errors.test.ts、src/components/EditorPane.vue
- 新建:src/services/fileService.save-errors.test.ts、src/components/EditorPane.reload-error.test.ts

## 实现内容
1. tauriSaveFile / tauriNewFile:对话框异常抛 QlError;写盘失败经 withFallbackCode 兜底升级 FILE_WRITE_FAILED;取消仍返回 null
2. webSaveFile:AbortError = 用户取消 → null(对齐 Tauri 取消语义);选择器/写盘异常 → QlError
3. errors.ts:新增 withFallbackCode 纯函数(C2),INTERNAL_ERROR 才升级,显式码不动
4. EditorPane.onReload:readTextFile 包 try/catch(交接备注#3)——静默 + 状态条 4s 可感知,卸载清理定时器
5. unwatchFileExternal 移除 console.warn(C3)

## DoD 检查单
- [x] worktree vue-tsc --noEmit → 0 错
- [x] worktree vitest errors.test(23)+ fileService.save-errors(13)+ EditorPane.reload-error(3)= 39/39
- [x] diff 文件全部落在边界内(6/6)
- [x] 原子提交,中文 conventional 信息
- [x] 主区合并后全量 173/173(无回退)
