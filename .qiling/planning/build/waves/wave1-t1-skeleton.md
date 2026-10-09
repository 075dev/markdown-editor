# Wave1 / T1-skeleton:错误结构 + 事件 payload kind

## 任务卡(摘要)
- 边界:src-tauri/src/lib.rs、src/services/fileService.ts、新建 src/services/errors.ts + errors.test.ts
- 严格度:HEAVY(Rust 变更 + 新模块)
- 验收:worktree 内 vue-tsc 0 错 + vitest errors.test 全绿;合并后主区 cargo check 通过

## 执行记录
- 模式偏差:环境无 subagent 派发工具面,zcode CLI 不在 PATH → 按 config fallback_to_sequential=true 降级,协调器顺序执行(隔离/边界/验证纪律保持)
- 实现:errors.ts(QlErrorCode 七码 + normalizeError:CODE 前缀 → 模式匹配 → INTERNAL_ERROR 兜底);lib.rs read_file/watch_file 错误前缀化(FILE_READ_FAILED/FILE_NOT_FOUND/WATCH_FAILED)+ notify 回调 payload 增加 kind(Remove→removed,其余→modified);fileService readTextFile/watchFileExternal 抛 QlError + CustomEvent 透传 kind(默认 modified)
- 修复记录:errors.test 一处用例断言错误(FILE_NOT_FOUND_LIKE 不含可匹配短语)→ 改为 FILE_NOT_FOUNDED: not found here
- worktree 验证:vue-tsc 0 错;vitest src/services/errors.test.ts 16/16
- 合并后验证:cargo check(src-tauri)PASS(唯一 warning 为既有 PlantumlChild.health_url dead_code,非本次引入)

## 提交
- feat:a06145c(4 files, +183/-19)
- merge:cdd5f2e
