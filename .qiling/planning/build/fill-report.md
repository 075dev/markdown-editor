# 填充阶段报告(Fill)—— ql Phase 1 自动保存 + 冲突安全网

- 分支:ql/phase-1-autosave(骨架末 ae7f577 → 填充末 7714952 + c0062c1)
- 日期:2026-09-14
- 执行模式:降级顺序执行(无子智能体工具面,fallback_to_sequential=true);worktree 隔离、文件边界、验证门控、波次拓扑、合并前实测全部保留;并行度计划 2 降为 1
- 波次:Wave 1(T1-fill + T3-fill)→ Wave 2(T2-fill),全部 PASS

## 一、mock 替换率(骨架留白 → 已填充)

| # | 骨架留白项 | 状态 | 填充位置 |
|---|-----------|------|---------|
| 1 | save/new 写盘错误吞掉/裸抛 → 契约 QlError | 已填充 | fileService(tauriSaveFile/tauriNewFile/webSaveFile)+ errors.withFallbackCode |
| 2 | Web 取消(AbortError)未对齐「取消=null」契约 | 已填充 | fileService.isAbortError 分支 |
| 3 | EditorPane.onReload 读盘无保护(交接备注#3) | 已填充 | EditorPane try/catch + editor-reload-error 状态条(4s 自清) |
| 4 | 指数退避重试(骨架未实现) | 已填充 | useAutoSave RETRYABLE_CODES + retryRound/scheduleRetryChain |
| 5 | blur 失焦保存(骨架未实现) | 已填充 | useAutoSave.onBlur + workspace.saveAllDirty |
| 6 | kind=removed 消费(骨架仅透传) | 已填充 | workspace.handleExternalChange(kind) + conflictKind + Banner 文案 |
| 7 | content.length 近似(交接备注#4) | 已填充 | useAutoSave.hashContent(FNV-1a) |
| 8 | conflict 态关闭标签缺显式测试(交接备注#5) | 已填充 | workspace.watch.test(closeTab=false/forceCloseTab 用例) |
| 9 | 设置开关文案为骨架措辞 | 已填充 | SettingsView 提示语(1.5s/失焦/重试/安全网)+ settings 注释定稿 |
| 10 | saveActive 无错误捕获(Ctrl+S 链路裸抛风险) | 已填充 | workspace.saveTab 统一捕获 QlError → lastSaveError + saveNotice |
| 11 | Rust 结构化 Err 对象(C4 完全体) | **未填充(有意)** | 触碰时迁移策略:本阶段前端已消费前缀码,结构化改造登记为契约修订待办 |
| 12 | open-diagram-window 等契约分歧(偏差#3~#7) | **未填充(有意,超范围)** | 见"契约修订待办",留下一轮 /ql-design |

留白填充率:10/12 显式填充,2/12 有意登记(不属本阶段范围)。**零 mock 存留**:grep 非测试源码无 TODO/FIXME/占位/骨架待办措辞(唯一"骨架期"历史注释已定稿清理 c0062c1)。

## 二、测试统计

| 阶段点 | 文件数 | 用例数 |
|--------|--------|--------|
| 骨架基线 | 23 | 148 |
| 填充交付 | 24 | **201**(+53,+35.8%) |

新增分布:T1-fill 23(errors.test +7、fileService.save-errors.test 新 13、EditorPane.reload-error.test 新 3);T3-fill 2(settings.autosave.test +2);T2-fill 28(useAutoSave.test +13、workspace.watch.test +8、AutoSaveBanner.test 新 7)。

## 三、边缘场景对照表(event-flow 9 条 ↔ 实现/测试)

| # | 边缘场景 | 实现位置 | 测试位置 |
|---|---------|---------|---------|
| 1 | 防抖窗口连续输入只写一次 | useAutoSave.scheduleSave(重置定时器) | useAutoSave.test「防抖窗口内连续输入只保存最后一次」 |
| 2 | 写盘失败退避 1s/2s/4s 共 3 次,仍败保持 Dirty | useAutoSave.scheduleRetryChain/retryRound | useAutoSave.test「3 次重试均失败…」等 6 例 |
| 3 | Conflict 态忽略后续外部修改 | workspace.handleExternalChange(首行短路) | workspace.watch.test「Conflict → 忽略」+ removed 变体 |
| 4 | kind=removed → Conflict + 提示「已在外部被删除」 | handleExternalChange(kind=removed)+ AutoSaveBanner.conflictText | workspace.watch.test removed 4 例 + AutoSaveBanner.test removed 文案 |
| 5 | untitled 不参与自动保存 | useAutoSave.scheduleSave/!path + saveTab 短路 + saveAllDirty 过滤 | useAutoSave.test untitled 2 例 |
| 6 | Conflict 态关闭标签弹确认 | closeTab 返回 false(既有)+ 显式测试 | workspace.watch.test「conflict 态关闭标签确认」2 例 |
| 7 | 保存成功后立即再输入开启新防抖轮 | updateActiveContent → dirty → scheduleSave | useAutoSave.test「保存成功后…再次编辑」 |
| 8 | 多标签同时 Dirty + 失焦:顺序保存互不阻断 | workspace.saveAllDirty + useAutoSave.onBlur | useAutoSave.test blur 4 例(含单标签失败他标签照存) |
| 9 | 开关关闭:防抖/失焦/重试全停,安全网仍生效 | useAutoSave 三入口检查 autoSaveEnabled;handleExternalChange 不查开关 | useAutoSave.test「开关关闭 blur 也不保存」+ workspace.watch.test 安全网独立用例 |

## 四、契约修订待办(遗留 /ql-design 就地修订,本阶段未动代码)

| # | 项 | 现状 | 建议修订方向 |
|---|----|------|-------------|
| 1 | 偏差#3 /ipc/open-diagram-window | 实现 url 必填;契约 title/source/diagramType 必填 | 语义对齐:以"source+diagramType 服务端组 URL"或"url 直传"二选一,重写契约 |
| 2 | 偏差#4 /ipc/list-system-fonts | 实现 {all,sans,mono};契约 {fonts[]} | 改契约为实现超集结构 |
| 3 | 偏差#5 /ipc/list-directory | 实现裸 DirEntry[];契约 {entries[]} | 改契约为裸数组(实现更简) |
| 4 | 偏差#6 /ipc/read-file | 实现返回 string;契约 OpenFileResult | 改契约:content string(前端自持 path) |
| 5 | 偏差#7 watch/unwatch 响应 | 实现 null(unit);契约 {ok:true} | 改契约:null 或统一 {ok} |
| 6 | C4 结构化 Err 对象 | Rust 侧 "CODE: message" 前缀约定 + 前端 normalizeError | 下一轮触碰 src-tauri 时迁移 Result<_, QlError>{code,message};前端前缀解析保留兼容 |

## 五、豁免登记(建议入宪法豁免表)

| 原则 | 位置 | 违规内容 | 为什么暂不修 | 简单方案为何被否 |
|------|------|---------|-------------|----------------|
| C1 服务层封装 | src/markdown/plantumlRehype.ts:53 | 直连 @tauri-apps/api/core(invoke) | 存量违规,非本阶段引入;迁移需动 PlantUML 渲染管线,超出"自动保存+冲突安全网"范围 | 就地 import 迁 services 需要重组 rehype 插件的依赖注入方式,应随"图表窗口契约修订(#3-1)"一并处理,避免两次回归 |

## 六、验证结果汇总

| 门 | Wave 1(主区) | Wave 2(主区) |
|----|--------------|--------------|
| vue-tsc --noEmit | PASS(0 错) | PASS(0 错) |
| vitest run | PASS 173/173 | PASS 201/201 |
| cargo check | PASS(Finished 0.36s,无新增 warning) | 不适用(无 Rust 改动) |
| C1 grep | — | 仅存量 1 处(已登记) |

## 七、指标

- 波次:2(计划 2);任务 3,全部 PASS,0 FAIL,0 NOT_RUN
- 提交:367a0a0(T1-fill)、81aa742(T3-fill)、89cb132(T2-fill)、c0062c1(注释定稿);merge:e0659c9、8eea2eb、7714952
- 台账:.planning/build/progress.md(填充段 3 任务 + 2 波次验证 = 5 条 PASS)
