# 骨架阶段报告(Walking Skeleton)—— ql Phase 1 自动保存 + 冲突安全网

- 分支:ql/phase-1-autosave(基线 bc234d2 → 交付 bb049df)
- 日期:2026-09-14
- 执行模式:**降级顺序执行**(环境无 subagent 派发工具面,且 zcode CLI 不在 PATH;按 config.parallelization.fallback_to_sequential=true 降级)。worktree 隔离、文件边界、验证门控、波次拓扑、合并前实测全部保留;并行度从计划 2 降为 1。

## 一、覆盖矩阵(契约 11 端点 + 1 事件)

| # | 契约项 | 类型 | 状态 | 覆盖任务 | 实现位置 |
|---|--------|------|------|----------|----------|
| 1 | /ipc/open-file-dialog | 端点 | pre-existing 已对账 | AUDIT | fileService.tauriOpenFile(plugin-dialog+fs 直调) |
| 2 | /ipc/save-file | 端点 | pre-existing 已对账 | AUDIT | fileService.tauriSaveFile(静默写/另存为双语义 ✓) |
| 3 | /ipc/new-file | 端点 | pre-existing 已对账 | AUDIT | fileService.tauriNewFile(强制另存为 ✓) |
| 4 | /ipc/read-file | 端点 | pre-existing + T1 增量 | T1 | lib.rs read_file;T1 错误前缀化 |
| 5 | /ipc/watch-file | 端点 | pre-existing + T1 增量 | T1 | lib.rs watch_file;T1 错误前缀化 |
| 6 | /ipc/unwatch-file | 端点 | pre-existing 已对账 | AUDIT | lib.rs unwatch_file |
| 7 | /ipc/pick-directory | 端点 | pre-existing 已对账 | AUDIT | fileService.tauriPickDirectory |
| 8 | /ipc/list-directory | 端点 | pre-existing 已对账 | AUDIT | fileService.tauriListDir |
| 9 | /ipc/open-diagram-window | 端点 | pre-existing 已对账(偏差见下) | AUDIT | lib.rs open_diagram_window |
| 10 | /ipc/list-system-fonts | 端点 | pre-existing 已对账(偏差见下) | AUDIT | lib.rs list_system_fonts |
| 11 | /ipc/get-plantuml-server-url | 端点 | pre-existing 已对账 | AUDIT | lib.rs get_plantuml_server_url |
| 12 | event:file-external-change | 事件 | pre-existing + T1 目标态达成 | T1 | lib.rs notify 回调;workspace store 订阅(T2 状态机) |

零任务覆盖项 = 0;孤儿任务 = 0;术语漂移 = 0(QlErrorCode 与契约 Error.code 枚举逐项一致)。

## 二、对账偏差(逐条)

### 目标态增量(本次骨架已落地)
1. **file-external-change payload kind**:契约 `{path, kind: modified|removed}`;T1 前仅 `{path}`。T1 已实现:notify EventKind Remove 类→removed,其余关注类型(Data/RenameTo/Create)→modified;前端 CustomEvent 透传 kind(缺省 modified)。⏳ 填充阶段:消费端 kind=removed 处理(状态栏提示 + Conflict)。
2. **错误码结构**:契约 Error{code,message};存量 Rust Result<_,String> 裸串。T1 骨架目标态:read_file/watch_file 两通道 `"CODE: message"` 前缀 + 前端 normalizeError(QlError,前缀→模式匹配→兜底,16 测试)。⏳ 填充阶段:save_file/new-file 等通道触碰时迁移(宪法 C4);结构化 Err 对象替代前缀约定。

### 结构偏差(存量,骨架不修改,填充阶段决策)
3. **open-diagram-window 签名**:实现 `url(必填)+title/source/width/height/window_key(可选)`;契约 `required [title, source, diagramType]`,无 url/width/height/window_key。语义差距大:契约以 source+diagramType 为核心,实现以 url 为核心。建议填充阶段前先做契约修订(ql-design),二者需对齐。
4. **list-system-fonts 响应**:实现 `{all, sans, mono}`;契约 `{fonts: string[]}`。实现信息是契约超集,建议改契约。
5. **list-directory 响应**:实现裸 `DirEntry[]`;契约 `{entries: DirEntry[]}` 包装。小偏差,建议改契约或包一层。
6. **read-file 响应**:实现返回 content 字符串;契约 OpenFileResult{path,content}(前端已持有 path,可接受,建议改契约)。
7. **watch-file/unwatch-file 响应**:实现 null(unit);契约 `{ok: true}`。建议改契约。
8. **get-plantuml-server-url 语义**:契约描述"未配置回退 plantuml.com";实现为本地 java 服务(18080)探测 + 前端 fallback。返回类型 Option<String> ↔ url:string|null 一致。

### 行为对账(已验证一致)
9. watch-file 单目标 + 1s 节流 ✓;save-file 静默写(自动保存不弹窗)✓;用户取消返回 null ✓;DirEntry{name,path,isDir} ✓;web 降级路径存在(C2)✓。

## 三、骨架交付(T1/T2/T3)

| 任务 | 波次 | 严格度 | 提交 | merge | diff | 内容 |
|------|------|--------|------|-------|------|------|
| T1-skeleton | 1 | HEAVY | a06145c | cdd5f2e | +183/-19 | errors.ts+test;lib.rs kind+错误前缀;fileService 接入 |
| T3-skeleton | 1 | LIGHT | 426b38b | 3143cfb | +136/-2 | autoSaveEnabled(默认 false)+ 设置页开关 + test |
| T2-skeleton | 2 | HEAVY | cc9631b | bb049df | +513/-58 | TabFileStatus 状态机;useAutoSave(1500ms 防抖);AutoSaveBanner;HomeView 挂载;watch.test 重写 |

骨架纪律:未实现填充阶段项(指数退避、blur 失焦保存、kind=removed 消费、结构化 Rust 错误对象);总量 +832/-79,测试占 ~55%。

## 四、验证结果

| 门 | 命令 | 结果 |
|----|------|------|
| Wave1 worktree | vue-tsc --noEmit;vitest errors.test | PASS(0 错;16/16) |
| Wave1 worktree | vue-tsc;vitest settings x3 | PASS(0 错;29/29) |
| Wave1 主区 | vue-tsc;vitest run;cargo check | PASS(136/136;cargo Finished 9.86s,唯一 warning 为既有 health_url dead_code) |
| Wave2 worktree | vue-tsc;vitest useAutoSave+workspace+watch | PASS(0 错;34/34) |
| Wave2 主区 | vue-tsc;vitest run | PASS(148/148,基线 118 净增 30) |

## 五、宪法门控

- C1:**存量违规 1 处**——src/markdown/plantumlRehype.ts:53 直连 @tauri-apps/api/core。非本次引入(骨架不越界修复);建议填充阶段迁入 services/ 并登记豁免表。
- C2:PASS——新增 errors.ts 为纯函数(已注释声明);既有 service 降级路径未破坏。
- C3:PASS——本次文件无 console 残留;T1 顺手移除 fileService 两处 console.warn。
- C4:部分推进(read_file/watch_file 前缀化),符合"触碰时顺手迁移"。

## 六、给填充阶段的交接备注

1. workspace 的 window listener 在 store 创建时注册且不随 pinia 卸载——测试必须单 pinia(beforeAll)+ 手动重置,否则旧实例 listener 污染断言(workspace.watch.test.ts 已示范)。
2. Vue watch 异步 flush + fake timers:cancelPending 前需 advanceTimersByTimeAsync(0) 冲微任务(useAutoSave.test.ts 已示范)。
3. EditorPane.onReload 调 readTextFile 无 try/catch:T1 后 readTextFile 失败会抛 QlError(真机 unhandled rejection 风险);填充阶段处理 kind=removed 时一并加保护。
4. useAutoSave 以 content.length 近似"内容变了"(等长替换不触发),填充阶段换 hash。
5. conflict 态关闭标签确认(event-flow 边缘场景)尚未接:closeTab 对 conflict 标签因 content!==savedContent 已返回 false 走既有确认路径,行为可接受但需填充阶段显式测试。
6. open-diagram-window 的契约/实现签名分歧需先修订契约再动代码(偏差 #3)。

## 七、指标

- 波次:2(计划)/ 实际顺序执行;任务 3,全部 PASS,0 FAIL,0 NOT_RUN
- worker:计划 3(ql-builder-worker)+ 1 audit;实际 0 派发(降级),协调器执行
- 测试:148/148 全绿;新增测试 30 个
- 台账:.planning/build/progress.md(5/5 PASS)
