status: passed
verified_at_commit: 7a2e899

# 交付时效声明(2026-10-09,add-005 + add-006 交付)

- **status: passed @ `7a2e899`**(分支 ql/add-005-kuml)——本次交付增量:`67171c6(main)..7a2e899` = add-005(kUML 图表支持)+ add-006(应用内语法速查面板)。主会话 fresh evidence:
  - `pnpm typecheck`:PASS(exit 0)
  - `pnpm test -- --run`:PASS **380/380**(42 文件;基线 337 + add-005 新增 16 + add-006 新增 27)
  - `pnpm build`:PASS(10.30s)
  - `cargo test`(src-tauri):PASS **17/17**(render_kuml 新增 10 例);`cargo check` PASS(仅存量 warning)
- 注:`pnpm lint` 因 @eslint/js 缺失不可跑(预存损坏,基线同样);kUML 真实 CLI 端到端待用户环境(`choco install kuml`),KUML_NOT_FOUND 路径已真机条件测试覆盖。
- 各增量详细记录:[./add-005-fill-w1.md](./add-005-fill-w1.md)、[./add-005-fill-w2.md](./add-005-fill-w2.md)、[./add-006-fill-w1.md](./add-006-fill-w1.md)
- 下方 2026-09-28 声明与 Phase 1 正文为历史记录,保留作审计留痕。

# 验证报告(Verification)—— ql Phase 1 自动保存 + 冲突安全网

- status: passed

## 交付时效声明(2026-09-28,本次交付覆盖)

- **status: passed @ `e5cd0f0`**——以下为本次交付增量(`d0a7a53..e5cd0f0`:文档树重扫 + bugfix-003/004 + add-003/004)的新鲜证据,各增量详细记录见本文件对应小节:
  - bugfix-003(链接跳转未保存保护):B1-B5——全量 327/327、typecheck/build PASS、真机 CDP 终验、评审 approved
  - add-003(正文染色主题):A1-A6——全量 327/327、follow 逐像素恒等核对、对比度实测、评审 2 轮 approved
  - bugfix-004(工作区 fs scope):回归 3 例 + cargo check + 真机 scope 外全链路终验(报告见 `.planning/bugfix/004-workspace-fs-scope-forbidden.md`)
  - add-004(语法染色主题):S1-S6——全量 335/335、follow 逐变量恒等核对、评审 2 轮 approved(报告 `.planning/build/add-004-review.md`)
- **最终全量(交付时点)**:`pnpm test` **335/335**(36 文件)、`pnpm typecheck` 0 错误、`pnpm build` PASS——提交本声明的 commit 即交付 HEAD。
- 下方第 1/2 轮正文为 Phase 1 基线时期(0a511b3)的历史记录,保留作审计留痕。

- 分支:ql/phase-1-autosave,HEAD = 0a511b3,评审 diff 锚点 bc234d2(`git diff bc234d2..HEAD` = 30 文件,+2468/-134)
- 日期:2026-09-14
- 验证方式:全部命令亲历执行(fresh evidence),契约/流程逐条对照实现源码与测试文件,未采信前阶段报告数字
- 结论:A 组 4 PASS + 1 NOT_RUN(PRE-EXISTING 环境缺口);契约 11/11 实现存在(4 字面合规 + 5 已登记偏差 + 2 类型一致/超集);流程状态机 7 转换全锁定、边缘场景 9/9 属实;残留零新增

## 一、A 组:命令验证矩阵

| # | 命令 | 结果 | 关键数字/证据 |
|---|------|------|--------------|
| A1 | `./node_modules/.bin/vue-tsc --noEmit` | PASS | exit 0,0 错误 |
| A2 | `./node_modules/.bin/vitest run` | PASS | **201/201 通过,24 个测试文件**,4.19s(与 fill-report 声明一致,本次系独立复跑) |
| A3 | `./node_modules/.bin/eslint . --ext .vue,.ts,.tsx` | NOT_RUN | PRE-EXISTING(见第三节);本次代码无法归因 lint 违规 |
| A4 | `./node_modules/.bin/vite build` | PASS | `✓ built in 8.46s`,dist/ 产出;仅既有 chunk>500kB 提示(main 721.50 kB,构建警告非错误) |
| A5 | `cargo check`(src-tauri/) | PASS | `Finished dev profile in 0.37s`;唯一 warning = `health_url` dead_code(lib.rs:426)→ PRE-EXISTING |

## 二、B 组:契约符合性(openapi.yaml ↔ 实现,独立抽查)

| # | 契约项 | 实现存在 | 响应结构 | 错误路径 | 判定 |
|---|--------|---------|---------|---------|------|
| 1 | /ipc/open-file-dialog | fileService.tauriOpenFile(fileService.ts:36-46) | {path,content} + 取消 null ✓,filters md/markdown/mdx/txt ✓ | 读失败经上层冒泡(C4 结构化范围) | 合规 |
| 2 | /ipc/save-file | tauriSaveFile(fileService.ts:48-77) | {path} + 取消 null ✓;有 path 静默写、无 path 弹框双语义 ✓ | withFallbackCode→FILE_WRITE_FAILED(:74) | 合规 |
| 3 | /ipc/new-file | tauriNewFile(fileService.ts:79-100) | 强制另存为 + 默认 untitled.md ✓ | FILE_WRITE_FAILED 兜底(:97) | 合规 |
| 4 | /ipc/read-file | lib.rs read_file(:403-405) | 返回 string(**偏差 #6 属实**,契约 OpenFileResult) | FILE_READ_FAILED 前缀 | 合规(偏差已登记);低危观察见第五节 |
| 5 | /ipc/watch-file | lib.rs watch_file(:320-392) | 返回 null(**偏差 #7 属实**,契约 {ok}) | FILE_NOT_FOUND(:331)/WATCH_FAILED(:380,384)前缀 | 合规(偏差已登记) |
| 6 | /ipc/unwatch-file | lib.rs unwatch_file(:396-399) | null,幂等(**偏差 #7 属实**) | 契约未定义错误响应 | 合规(偏差已登记) |
| 7 | /ipc/pick-directory | tauriPickDirectory(fileService.ts:102-107) | string \| null,与契约字面一致 | — | 合规 |
| 8 | /ipc/list-directory | tauriListDir(fileService.ts:109-117) | 裸 DirEntry[](**偏差 #5 属实**,契约 {entries});DirEntry{name,path,isDir} 字段一致 | 原始抛错冒泡(C4 范围) | 合规(偏差已登记) |
| 9 | /ipc/open-diagram-window | lib.rs(:174-222)+ diagramWindow.ts:45-51 | url 必填,title/source/width/height/window_key 可选(**偏差 #3 属实**,契约 required [title,source,diagramType]) | map_err 原始串(C4 范围) | 合规(偏差已登记) |
| 10 | /ipc/list-system-fonts | lib.rs(:248)+ fontService.ts | {all,sans,mono}(**偏差 #4 属实**,契约 {fonts[]}) | — | 合规(偏差已登记) |
| 11 | /ipc/get-plantuml-server-url | lib.rs(:576 Option<String>)+ plantumlRehype.ts:53-54 | url: string \| null,与契约类型一致 | — | 合规 |

**事件 file-external-change(x-ql-events):PASS** —— payload 目标态 {path, kind: modified|removed} 已达成(lib.rs:352-373:Remove→removed,Data/RenameTo/Create→modified,1s 节流:359-367,单目标 ACTIVE_WATCHER:314)。订阅链路四段闭环,逐段核实:
1. Rust emit(lib.rs:370-373)→ 2. fileService listen + CustomEvent 透传(fileService.ts:250-261,kind 缺省 modified)→ 3. workspace.handleExternalChange 三分支(workspace.ts:125-142:未打开 :127 忽略 / Conflict :128 忽略 / removed :129-135 → Conflict / Dirty :136-140 → Conflict / Clean :141 静默重载)→ 4. EditorPane onReload 读盘刷新(EditorPane.vue:53,88-95,try/catch + editor-reload-error 4s 自清,测试 EditorPane.reload-error.test.ts 3 例)。

**契约总结:11/11 端点实现存在;4 项与契约字面一致;5 项落入 fill-report 第四节已登记偏差(#3~#7),逐条核对属实;2 项类型一致/超集。零契约项无实现。错误结构目标态 {code,message} 经 "CODE: message" 前缀 + normalizeError/errors.ts:32-33 达成前端态(Rust 结构化对象为登记待办 C4,非本次 FAIL)。**

## 三、C 组:流程图符合性(event-flow.md ↔ 测试)

### 状态机转换(TabFileStatus)

| 转换 | 测试锁定 | 证据 |
|------|---------|------|
| Clean→Dirty(编辑) | ✓ | workspace.test.ts:79「updateActiveContent makes tab dirty」;实现 workspace.ts:298-308 |
| Dirty→Clean(保存成功:手动/防抖/失焦) | ✓ | useAutoSave.test.ts:133;实现 workspace.ts:327 |
| Dirty→Conflict(外部修改) | ✓ | workspace.watch.test.ts:87 |
| Conflict→Clean(保留我的,覆盖写盘) | ✓ | workspace.watch.test.ts:138;实现 workspace.ts:147-168 |
| Conflict→Clean(用磁盘版本,重载) | ✓ | workspace.watch.test.ts:155;实现 workspace.ts:173-180 |
| Conflict 态关闭标签确认 | ✓ | workspace.watch.test.ts:257(closeTab 返回 false)/ 268(forceCloseTab);实现 workspace.ts:266-290 |
| Conflict 态继续编辑状态不变 | ✓ | workspace.watch.test.ts:125;实现 workspace.ts:301-305 |

### 边缘场景表 9 条 ↔ 实现与测试(9/9 全核实,超出"至少 4 条"要求)

| # | 场景 | 实现证据(文件:行号) | 测试证据(文件:行号) | 判定 |
|---|------|---------------------|---------------------|------|
| 1 | 防抖窗口连续输入只写一次 | useAutoSave.ts:141-145(cancelPending 后重设) | useAutoSave.test.ts:103 | 属实 |
| 2 | 失败退避 1s/2s/4s 共 3 次,用尽保持 Dirty | useAutoSave.ts:18(常量 [1000,2000,4000])+ :105-121 | useAutoSave.test.ts:184(第 3 次成功)/209(用尽) | 属实 |
| 3 | Conflict 忽略后续外部修改 | workspace.ts:128(首行短路) | workspace.watch.test.ts:101、214 | 属实 |
| 4 | kind=removed → Conflict + 「已在外部被删除」 | workspace.ts:129-135 + AutoSaveBanner.vue:22 | workspace.watch.test.ts:190/204/228 + AutoSaveBanner.test(removed 文案) | 属实 |
| 5 | untitled 不参与自动保存 | useAutoSave.ts:140 + workspace.ts:319 | useAutoSave.test.ts:332、350 | 属实 |
| 6 | Conflict 态关闭标签弹确认 | workspace.ts:269-271(conflict 时 content≠savedContent → false) | workspace.watch.test.ts:257/268 | 属实 |
| 7 | 保存成功后立即再输入开启新防抖轮 | workspace.ts:307(状态回 dirty)+ useAutoSave.ts:169-175(watch 触发 scheduleSave) | useAutoSave.test.ts:133 | 属实 |
| 8 | 多标签 Dirty 失焦:顺序保存互不阻断 | workspace.ts:353-358(saveAllDirty 逐个 await,异常在 saveTab 内消化)+ useAutoSave.ts:152-166 | useAutoSave.test.ts:277、293 | 属实 |
| 9 | 开关关闭全停,安全网仍生效 | useAutoSave.ts:136、153(防抖/失焦入口)+ workspace.ts:125(handleExternalChange 不查开关) | useAutoSave.test.ts:321 + workspace.watch.test.ts:280 | 属实 |

fill-report 第三节对照表 **9/9 属实**。自动保存核心参数与流程图一致:防抖 1500ms(useAutoSave.ts:16)、失焦取消防抖立即保存(onBlur:154)、重试仅对可重试码 FILE_WRITE_FAILED/FILE_READ_FAILED(:20)。

## 四、D 组:残留检查

| 检查项 | 命令/方法 | 结果 |
|--------|----------|------|
| TODO/FIXME/TBD/待定/占位符 | grep 非测试源码(src/**.ts,*.vue) | **0 命中**(PASS)。"placeholder" 命中均为 CSS 类名(FolderTreeNode.vue:107)与 HTML input 属性(SettingsView.vue:226,272),非代码占位 |
| console.* | grep + `git diff bc234d2..HEAD` 新增行判定 | 非测试源码共 8 处,**本次新增 0 处**(逐文件 `git diff | grep -c '^+.*console\.'` 全为 0);全部 PRE-EXISTING(见下) |
| "骨架期"待办措辞 | grep | fileService.ts:264、288 两处 "骨架期契约:…不再吞错" 为**历史行为描述注释**(语义完整,非待办);errors.ts 待办措辞已由 c0062c1 定稿清理。观察项,不构成 FAIL |
| worktree 清理 | `git worktree list` | 仅主工作区 D:/AIWorkSpace/MarkDownEditor(0a511b3)✓,无残留 worktree/分支 |

## 五、PRE-EXISTING 汇总(均非本次引入)

1. **ESLint 无法运行(A3 NOT_RUN 根因)**:eslint.config.js:1,3 顶层 import `@eslint/js` 与 `typescript-eslint`,package.json devDependencies 仅声明 `eslint`(:55)未声明这两个包,node_modules 中亦无。`package.json`/`eslint.config.js`/`pnpm-lock.yaml` 均不在 bc234d2..HEAD 变更清单中(0 文件)→ 基线即缺依赖。修复建议(后续阶段):`pnpm add -D @eslint/js typescript-eslint`,与本阶段代码无关。
2. **cargo warning `health_url` dead_code**:src-tauri/src/lib.rs:426(任务书预期内)。
3. **基线 console 残留 8 处**(本次零新增):PreviewPane.vue:87、diagramWindow.ts:39,55、diagram-view/diagram.ts:54,85,95、mermaid.ts:126、workspace.ts:454(expandNode 兜底日志,基线已有)、plantumlRehype.ts:199。另 plantumlRehype.ts:53 直连 invoke(C1 存量违规,fill-report 第五节已登记豁免)。
4. **构建 chunk 警告**:main 721.50 kB > 500kB(vite 提示,非错误,基线架构所致)。

## 六、新发现(低危观察,不阻塞,建议随契约修订待办一并处理)

- **read-file 错误码粒度**:lib.rs:403-405 对所有读失败(含文件不存在)统一返回 `FILE_READ_FAILED` 前缀;契约区分 404 FILE_NOT_FOUND / 500 FILE_READ_FAILED。影响:前端对不存在文件的 read 得到 FILE_READ_FAILED 而非 FILE_NOT_FOUND(errors.ts 模式匹配 "not found" 无法命中 "os error 2" 类系统消息)。行为可观察且经 normalizeError 规范化,仅 code 粒度与契约不完全一致;未列入前阶段登记偏差,建议在 C4 结构化迁移(修订待办 #6)时一并修正。

## 七、主会话复核建议

最关键的两条命令(2 分钟内可复跑):
1. `./node_modules/.bin/vitest run` —— 201/201 是本阶段质量主张的核心证据,复跑即可证伪/证实全部行为锁定(状态机 + 9 边缘场景 + 错误规范化均在其中)。
2. `./node_modules/.bin/vue-tsc --noEmit` —— 类型面契约一致性(11 端点 TS 侧结构)的最快全量门。

(第三优先:`cd src-tauri && cargo check`,若需覆盖 Rust 侧。ESLint 在补装 @eslint/js + typescript-eslint 前无法给出信号。)


## 八、修复轮验证(round 1 后)

- 范围:评审 round 1 四项修复 C1/F2/F3/F4,commits 071cfad / 52e0a1f / 464e90f / 06e9134,HEAD = 06e9134(分支 ql/phase-1-autosave)
- 日期:2026-09-14;基线 201/201,只增不减
- 方式:每个修复提交前均跑 vue-tsc + 定向 vitest;最终 HEAD 全量复跑(fresh evidence)

| # | 命令 | 结果 | 关键数字/证据 |
|---|------|------|--------------|
| R1 | `./node_modules/.bin/vue-tsc --noEmit` | PASS | exit 0,0 错误(每个修复提交前均复跑) |
| R2 | `./node_modules/.bin/vitest run` | PASS | **214/214 通过,25 个测试文件**(基线 201 净增 13,全部为四项修复的装配/回归测试) |
| R3 | 定向 `vitest run src/views/HomeView.autosave.test.ts` | PASS | 3/3(C1 装配级:开关开→越防抖窗口写盘;开关关→不写盘;卸载→挂起定时器清理) |
| R4 | 定向 `vitest run src/composables/useAutoSave.test.ts` | PASS | 23/23(既有 20 例不回退 + F2 新增 3 例飞行中关闭) |
| R5 | 定向 `vitest run src/components/AutoSaveBanner.test.ts` | PASS | 9/9(既有 7 例不回退 + F3 多标签错位修复 1 例 + F4 读盘失败保持横幅 1 例) |
| R6 | 定向 `vitest run src/stores/workspace.watch.test.ts` | PASS | 21/21(既有 16 例不回退 + F4 真 clean 语义 5 例;3 个既有用例随 resolveConflictUseDisk 异步签名 await 化,行为意图不变) |

- 修复后行为结论:
  - 场景 1(防抖+失焦)/场景 3(重试)在**产品级**生效:HomeView.vue:49 装配 useAutoSave(),装配事实由测试锁定(C1 关闭)。
  - 边缘场景 9 升级:「飞行中关闭」即撤销挂起的防抖定时器与重试链(useAutoSave.ts:116、:146 回调入口复查 + :185-193 开关联动 watch),补齐 verification 第四节场景 9 的飞行中关闭子项。
  - 冲突横幅文案与按钮动作同源:按 conflict 标签列表逐条渲染(AutoSaveBanner.vue:17、:56、:64),决策支持按 path(workspace.ts:148、:177),F3 错位关闭。
  - 「用磁盘版本」不再假 clean:读盘成功且确认仍是同一 conflict 标签后才落 Clean(workspace.ts:177-206),失败保持 Conflict + error 通知;EditorPane 经 mde:reload-tab 携带 content 刷新、免二次读盘(EditorPane.vue:94),F4 关闭。
- 残留:F5-F8(minor)处置见 review.md 处置账本追加节(DEFERRED);A3 ESLint PRE-EXISTING 缺依赖未变。

---

## bugfix-003 验证补记(2026-09-28)

| # | 验证项 | 结果 | 证据 |
|---|--------|------|------|
| B1 | 定向 `vitest run src/components/PreviewPane.links-e2e.test.ts` | PASS | 6/6(mock 下沉到 invoke 桥 + 真实临时文件;dirty 保留用例修复前以 bug 方式失败:`expected '# next real content\n' to be '未保存的宝贵修改'`) |
| B2 | 全量 `pnpm test` | PASS | 317/317(33 文件),0 unhandled |
| B3 | `pnpm typecheck` / `pnpm build` | PASS | vue-tsc 0 错误;build 7.89s |
| B4 | 真机终验(Tauri dev + WebView2 CDP,页面内直驱真实 Pinia store) | PASS | dirty target.md 经链接跳转:content 保留 + `status=conflict` + `conflictKind=modified` + 目标标签激活(修复前为磁盘内容覆盖) |
| B5 | 证伪实验(ql-reviewer 独立) | PASS | `git stash` 回退修复 → 全量重跑唯一变红 = B1 的 dirty 保留用例;恢复后全绿 |

- 结论:`guardDirtyTab` 守卫(openFileFromPath/openFile 双入口)与既有冲突安全网(handleExternalChange → conflict、resolveConflictKeepMine/UseDisk、AutoSaveBanner 逐标签双按钮)语义同构,评审 approved(0 critical/3 non-critical)。详见 `.planning/bugfix/003-link-jump-overwrites-unsaved.md`。

---

## add-003 验证记录(2026-09-28,正文染色主题)

| # | 验证项 | 结果 | 证据 |
|---|--------|------|------|
| A1 | 定向 `vitest run src/stores/settings.content-theme.test.ts` | PASS | 7/7(默认 follow/方案集校验/持久化往返/data-content-theme 挂载与移除/非法回落/resetAll;属性断言经 nextTick 处理 watch pre-flush) |
| A2 | 全量 `pnpm test` | PASS | 327/327(35 文件,基线 320 净增 7) |
| A3 | `pnpm typecheck` / `pnpm build` | PASS | vue-tsc 0 错误 / 9.49s |
| A4 | follow 零行为变化(评审员逐项核对) | PASS | --content-* 11 项默认映射与 add-001 旧 token 逐项恒等(首轮 C1:--content-hr 误映射 --border-strong,已修为 --border) |
| A5 | 对比度(评审员实测) | PASS(修后) | 主文字/标题全部 ≥8.8;text-2 首轮 sepia 4.27 / parchment 3.78 低于 AA,加深为 #6b6149 / #6e6147 后复审确认 |
| A6 | 独立评审(ql-reviewer 三结论) | reviewed | 第 1 轮 criticals_found(C1 hr 映射 + N1 链接断言失实 + N2 对比度 + N3 留档缺失)→ 全部修复 → 第 2 轮复审(见 add 台账) |

---

## add-004 验证记录(2026-09-28,语法染色主题)

| # | 验证项 | 结果 | 证据 |
|---|--------|------|------|
| S1 | 定向 `vitest run src/stores/settings.syntax-theme.test.ts` | PASS | 8/8(默认 follow/方案集校验/持久化/data-syntax-theme 挂载与移除/与 contentTheme 三层正交/非法回落/resetAll) |
| S2 | 全量 `pnpm test` | PASS | 335/335(36 文件,基线 327 净增 8) |
| S3 | `pnpm typecheck` / `pnpm build` | PASS | vue-tsc 0 错误 / 9.71s |
| S4 | follow 逐像素恒等(评审员逐变量核对) | PASS | 12 变量默认映射与消费点旧值逐项恒等;首轮 C1(行内代码色泄漏进围栏代码块)已修:`:not(pre) > code` 限定 |
| S5 | 独立评审(ql-reviewer 三结论) | reviewed | 第 1 轮 criticals_found(C1 作用域泄漏 + N1 变量计数 + N3 组合限制未入契约 + N6 删除线装饰超承诺)→ 全部修复/补契约 → 第 2 轮复审(见 add 台账) |
| S6 | 评审留档 | PASS | `.planning/build/add-004-review.md`(评审员自写,feature-scoped 命名) |
