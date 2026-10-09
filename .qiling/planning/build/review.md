---
verdict: approved
reviewed_at: 2026-09-15T01:50:17+08:00
round: 2
reviewed_range: 0a511b3..fe679f2 (round 2 复审增量;round 1 全量为 bc234d2..0a511b3,见下文第 1 轮报告)
waived_by:
waive_reason:
inputs:
  - openapi.yaml
  - event-flow.md
  - constitution.md
  - verification.md
  - fill-report.md
  - skeleton-report.md
review_tier: THOROUGH (30 文件 > 20,涉及状态机/错误处理路径;全量三结论 + 对抗检查)
---

## 交付评审汇总(2026-10-09,add-005 + add-006 交付增量)

总体 verdict:**approved**。本次交付范围(`67171c6..7a2e899`,分支 ql/add-005-kuml)内各增量的独立评审结论:

| 增量 | 评审方式 | 轮次 | 结论 |
|------|----------|------|------|
| add-005 kUML 图表支持 | ql-reviewer 三结论 | 1 轮 | approved(0 critical / 5 non-critical;N1 sanitizer 加固已修,N5 EOF 已补,N2/N3/N4 记录) |
| add-006 应用内语法速查面板 | ql-reviewer 三结论 | 1 轮 | approved(0 critical / 2 non-critical;N1 经官方 README 原文闭环,N2 文案已修) |

各轮详情:[./add-005-review.md](./add-005-review.md)、[./add-006-review.md](./add-006-review.md)。
评审发现的既有缺陷(超增量范围,候选 bugfix-006):mermaid 客户端渲染选择器对真实管线输出命中 0(静默失效)。

## 交付评审汇总(2026-09-28,本次交付增量)

总体 verdict:**approved**。本次交付范围(`d0a7a53..e5cd0f0`)内各增量的独立评审结论:

| 增量 | 评审方式 | 轮次 | 结论 |
|------|----------|------|------|
| add-003 正文染色主题 | ql-reviewer 三结论 | 2 轮 | approved(首轮 criticals_found:--content-hr 映射违反 follow 恒等,已修) |
| add-004 语法染色主题 | ql-reviewer 三结论 | 2 轮 | approved(首轮 criticals_found:行内代码色泄漏进围栏代码块,已修) |
| bugfix-003 链接跳转覆盖未保存内容 | ql-reviewer | 1 轮 | approved(评审员证伪实验锁定回归) |
| bugfix-004 工作区 fs scope | ql-fix 流程 | — | skipped(真机 CDP 端到端取证替代独立评审;报告留档) |

各轮详情:下方第 1/2 轮正文(Phase 1 基线)、`.planning/add/003-content-theme.md`、`.planning/build/add-004-review.md`、`.planning/bugfix/00{3,4}-*.md`。

---

# 独立评审报告(第 1 轮)—— ql Phase 1 自动保存 + 冲突安全网

## 裁定:`criticals_found`

1 个 critical:自动保存 composable(useAutoSave)**在生产代码中零装配**——本阶段主题功能在真实应用中从未激活。全部 201 个单元测试通过是因为测试直接实例化 composable,掩盖了装配缺失。必须修复并复审后才能交付。

---

## 结论一:契约合规 —— **fail**

### 1a. IPC 契约(openapi.yaml)—— pass

11 端点 + 1 事件抽查与 verification.md B 组一致,零新增契约分歧:

| 契约项 | 结果 | 证据(亲核) |
|--------|------|------|
| file-external-change payload `{path, kind: modified\|removed}` | ✅ | lib.rs diff:EventKind::Remove→removed,Data/RenameTo/Create→modified,1s 节流保留;fileService.ts:250-261 透传 kind(缺省 modified) |
| 错误结构 `{code,message}` 前端态 | ✅ | errors.ts:12-25 QlError/QlErrorCode 与契约枚举逐项一致;CODE_PREFIX_RE(:32-33) |
| save/new 通道 FILE_WRITE_FAILED 兜底 | ✅ | fileService.ts:74、97、184、199 withFallbackCode |
| 偏差 #3~#7 + C4 结构化 Err | ✅ 已登记属实 | fill-report 第四节 6 项与 diff 逐条核对无误 |

### 1b. 行为契约(event-flow.md)—— **fail(装配缺失)**

代码与测试层面,以下条目**实现存在且被测试锁定**:
- 3 时序图参数:防抖 1500ms(useAutoSave.ts:16)、退避 [1000,2000,4000](:18)、blur 取消防抖立即保存(:152-166)——与规范逐字一致
- 状态机 7 转换、conflict 三分支与暂停/恢复、untitled 跳过、kind=removed、Conflict 态忽略后续事件、开关关闭安全网独立(workspace.ts:125-142;watch.test 20+ 用例真实断言)
- 边缘场景 9 条在**代码层**均可指认实现与测试(fill-report 第三节对照表核对属实)

**但场景 1(防抖+失焦)与场景 3(重试)在产品中不成立:**

| 验收项 | 结果 | 证据 |
|--------|------|------|
| 「内容变更防抖 1500ms → 写盘」在运行的应用中生效 | ❌ | `grep -rn "composables/useAutoSave" src/` 仅命中 useAutoSave.test.ts:11;`grep useAutoSave src/ --include=*.vue` 仅 AutoSaveBanner.vue:10 注释;App.vue/main.ts 无引用;HomeView.vue diff 仅挂载 AutoSaveBanner(line 10,111) |
| 「窗口失焦立即写入」在运行的应用中生效 | ❌ | window blur 监听仅存在于 useAutoSave(:177-179),而 useAutoSave 从未被调用 |
| 设置开关开 → 自动保存启用 | ❌ | SettingsView 开关联动 store 布尔值(settings.ts:326-332),消费方唯一是 useAutoSave(:136,153)——无人消费即 no-op |
| 「冲突安全网」(场景 2)生效 | ✅ | handleExternalChange 注册于 store 创建时(workspace.ts:215-222),Banner 挂载于 HomeView:111——此链路已接线 |
| 边缘场景 9「开关关闭→全部停用」 | ⚠️ 部分 | 关闭**后**的触发被挡(useAutoSave.test:80,321);但飞行中关闭不清已安排的定时器/重试链,见 M1 |

## 结论二:正确性 —— **fail**

测试本身扎实:定点复跑 `vitest run src/composables/useAutoSave.test.ts` = 20/20 PASS(1.42s,亲历);断言落在调用次数/参数/tab 状态/通知文案上,非空转;watch.test 对状态机的锁定真实。问题在装配与边界:

### Critical

| # | 问题 | 证据 | 修复指引 |
|---|------|------|----------|
| C1 | **useAutoSave 生产代码零装配**:防抖/失焦/重试三链路在真实应用中不存在,autoSaveEnabled 开关为 no-op。201 tests 全绿 = misleading_success_output(测试直接实例化,装配无人验证) | grep 三连(见 1b 表);HomeView.vue:10,111 仅挂 Banner;verification.md「边缘场景 9/9 属实」未覆盖装配维度 | 在应用根(App.vue 或 HomeView setup)调用 `useAutoSave()`;补一条装配级测试(mount HomeView → 编辑 → advanceTimers → saveMarkdownFile 被调),防止回归 |

### Major(非阻断,须修复)

| # | 问题 | 证据 | 修复指引 |
|---|------|------|----------|
| M1 | 开关飞行中关闭不撤已安排的保存/重试:`runAutoSaveRound` 与重试 setTimeout 回调均不检查 autoSaveEnabled。开→输入→1.5s 内关→到点仍写盘;失败重试等待期关→1s/2s/4s 后仍写盘,违背用户明确关闭意图(边缘场景 9「全部停用」) | useAutoSave.ts:124-132(runAutoSaveRound 无开关检查)、:114-119(回调直接 retryRound)、:136(仅 scheduleSave 安排时检查);settings.ts:326-328 无联动;测试只盖「关闭后触发」未盖「安排后关闭」 | runAutoSaveRound 与重试回调入口各加一行 `if (!settings.autoSaveEnabled) return`;或 settings watcher 联动 cancelPending+clearRetries;补测试 |
| M2 | 横幅对象与决策操作对象错位:横幅显示 `tabs.find` 第一个 conflict 标签,双按钮操作 **activeTab**。多标签 conflict 时文案是 A 的、动作落在 B;若活动标签非 conflict,按钮静默无效(resolve 返回 false 无人消费) | AutoSaveBanner.vue:15-17(conflictTab=find)vs workspace.ts:148-149、:175(resolve 均 `activeTab` + `status!=='conflict'` return false) | Banner 把 conflictTab.path 传给 resolve 函数(按 path 决策),或横幅仅渲染活动标签的 conflict;补多标签 conflict 测试 |
| M3 | 「用磁盘版本」先置 clean 再异步重载:重载失败(EditorPane catch → return)或读盘期间切换标签(activeTabPath 过滤 → return)后,标签停留**假 clean**——content≠savedContent 但 status=clean,自动保存不接手,用户以为内容已是磁盘版本(实际编辑器仍显示自己版本)。状态机不变量被破坏 | workspace.ts:173-180(先 `status='clean'` 再派发 reload);EditorPane.vue:96-104(catch / activeTabPath 两处 return 均不回滚状态);watch.test:155-169 只测成功路径,reload-error.test 只断言通知条 | resolveConflictUseDisk 改为等重载成功再置 clean(或失败回 conflict);EditorPane 重载失败时回调 store 恢复 conflict;补失败路径状态断言 |

### Minor

| # | 问题 | 证据 |
|---|------|------|
| m1 | saveAllDirty 死代码:store 定义并导出,全仓无调用;blur 循环由 useAutoSave 自建。fill-report「blur 失焦保存 = useAutoSave.onBlur + workspace.saveAllDirty」与实际不符 | workspace.ts:353-358,501;useAutoSave.ts:152-166 自建循环;grep saveAllDirty 仅定义+导出两处 |
| m2 | 注释漂移:EditorPane 重载注释仍写「Q2 决策:冲突时外部覆盖本地未保存修改(简化策略)」,与现状(conflict 状态机保护双侧)矛盾,误导维护者 | EditorPane.vue:84-87 |
| m3 | isRetryable 读全局 lastSaveError 的耦合:saveTabByPath 因 tab 不存在返回 false 时不写 lastSaveError,isRetryable 会读到上一轮错误,把已关闭标签推进重试链(后果仅空恢复通知,无实害,但逻辑脆弱) | useAutoSave.ts:66-69、:161-163;workspace.ts:341-345 |
| m4 | PRE-EXISTING(非本次引入,登记观察):watchFileExternal 每次调用新建 listen,unlisten 被 watchPath 丢弃,标签切换累积前端监听器。diff 证实 listen 调用 bc234d2 已存在(本次仅改泛型参数)。本阶段冲突链路依赖该事件,建议顺手修 | fileService.ts:244-267(diff 仅类型变化);workspace.ts:187-193(`await watchFileExternal(path)` 丢弃返回值) |

## 结论三:代码库一致性 —— **pass**

- **C1(MUST)pass**:非 services 目录 `@tauri-apps` 导入仅 plantumlRehype.ts:53(PRE-EXISTING,已登记豁免建议);本次新增的 useAutoSave/AutoSaveBanner/EditorPane 改动均经 store/services 触达能力层。
- **C2(MUST)pass**:errors.ts 纯函数并注释声明;save/new/read/watch/unwatch 全部有 isTauri 分支(fileService.ts:210-231,244-304)。
- **C3(MUST)pass**:本次 diff 新增 console = 0(亲自 grep `^+.*console\.` 空);notify/error 文案走结构化通知,无裸 alert。
- 命名与模式一致:QlError/withFallbackCode 沿用 T1 骨架约定;测试组织(真实 store + vi.mock service + fake timers + scope 清理)与既有 workspace.test/watch.test 惯例一致。局部不一致即 m1(死代码)与 m2(注释漂移)。

## 验证摘要可信度

- **已抽查 A2**:以定点 `vitest run src/composables/useAutoSave.test.ts` 复跑(20/20 PASS,1.42s)代替全量重跑——与摘要「201/201」方向一致,未发现测试空转。
- **行号引用抽查**:verification.md 引用的 workspace.ts:125-142、:128、useAutoSave.ts:16/:18、fileService.ts:250-261 逐一核对**全部准确**;「新增 console 0 处」「C1 仅存量 1 处」经亲自 grep 证实。
- **重大盲区(本报告核心)**:verification 只验证「实现存在 + 测试通过」,未验证**应用装配**。A4 vite build PASS 只证明可编译;201 全绿恰是 C1(装配缺失)被掩盖的原因。其「边缘场景 9/9 属实」结论应降级为「代码层 9/9,产品级 6/9」(场景 1、2 之外的触发链、9 的飞行中关闭子项受影响)。
- **PRE-EXISTING 复核**:ESLint 依赖缺口、health_url dead_code、plantumlRehype.ts:53、基线 console 8 处、chunk 警告——均确认不在 bc234d2..0a511b3 变更内,与本次无关;新增 m4(listener 累积)同属存量。

## 处置账本(Review Dispositions Ledger,append-only)

> severity 采用本轮任务卡三级(critical/major/minor);模板语境下 major/minor 均属 non-critical 大类,仅 critical 阻断。disposition 由后续修复轮追加,本轮留空。

| # | 发现 | severity | disposition | evidence | decided_by | round |
|---|------|----------|-------------|----------|------------|-------|
| F1 | useAutoSave 生产代码零装配,自动保存/失焦/重试/开关均未生效 | critical | — | grep 三连 + HomeView.vue:10,111@0a511b3 | — | 1 |
| F2 | 开关飞行中关闭不撤已安排的防抖保存与重试链 | major | — | useAutoSave.ts:114-119,124-132@0a511b3 | — | 1 |
| F3 | 冲突横幅显示对象(tabs.find)与决策操作对象(activeTab)错位 | major | — | AutoSaveBanner.vue:15-17 + workspace.ts:148,175@0a511b3 | — | 1 |
| F4 | 「用磁盘版本」重载失败/被打断后标签停留假 clean | major | — | workspace.ts:173-180 + EditorPane.vue:96-104@0a511b3 | — | 1 |
| F5 | saveAllDirty 死代码;fill-report 对 blur 实现的描述与实际不符 | minor | — | workspace.ts:353-358@0a511b3 | — | 1 |
| F6 | EditorPane reload 注释漂移(Q2 决策措辞已过时) | minor | — | EditorPane.vue:84-87@0a511b3 | — | 1 |
| F7 | isRetryable 依赖全局 lastSaveError 的脆弱耦合 | minor | — | useAutoSave.ts:66-69@0a511b3 | — | 1 |
| F8 | watchFileExternal unlisten 泄漏(PRE-EXISTING,观察) | minor | — | fileService.ts:244-267 + workspace.ts:187-193@0a511b3 | — | 1 |

## 复审记录(round ≥ 2 时)

(待第 2 轮评审追加:F1-F4 修复后受影响区域复审;F5-F7 可随修复顺带,不单独设门。)

### 第 2 轮(round 2,2026-09-15)—— 复审范围 0a511b3..fe679f2

> 只复审第 1 轮 F1-F4 修复区域 + 新 critical 排查;round 1 全量范围 bc234d2..0a511b3 已审不重复。修复提交:071cfad(C1)/ 52e0a1f(F2)/ 464e90f(F3)/ 06e9134(F4)/ fe679f2(报告,纯 .planning 文档)。

#### 裁定:`approved`(第 1 轮 critical C1 已修复并证实,无新 critical)

**结论一:契约合规 —— pass**

| 项 | 证据(亲核,行号@06e9134 = @fe679f2,代码未再变) |
|----|------|
| F1 装配真实生效 | src/views/HomeView.vue:49 setup 中 `useAutoSave()`;清理由 useAutoSave.ts:195-206 onScopeDispose 承接(stop + stopEnabledWatch + cancelPending + clearRetries + blur 反注册);装配测试 src/views/HomeView.autosave.test.ts **亲跑 3/3 PASS(2.08s)**——mount 真实 HomeView(仅 stub 子组件模板,setup 照跑),不 mock composable 本身,只 mock fileService IO 边界,断言 `saveMarkdownFile('hello world','/a/demo.md')`,真实锁定 mount→编辑→防抖→写盘链路,无"测试也装配错了"的自我循环 |
| F2 三处全堵 | 防抖到点回调复查 useAutoSave.ts:147;重试回调复查 :117;关闭瞬间 watch(:186-193)cancelPending+clearRetries;另有既有 onBlur 入口检查 :157。runAutoSaveRound(:126)本身无检查但其全部两个调用入口(防抖回调/onBlur)均已被堵,无旁路;重开开关后由下次输入/失焦重新触发防抖,无"重开不恢复"缺陷。极端时序(重试回调先于 watch 微任务生效)有专门用例兜底(useAutoSave.test.ts「重试回调先于 watch 生效」) |
| F3 闭环正确 | AutoSaveBanner.vue:17 conflictTabs 逐条渲染;文案 conflictText(tab) 与按钮 keepMine(tab)/useDisk(tab)(:56/:64)同源同一 tab 对象;store 决策按 path 查找(workspace.ts:148、:177-178),目标非 conflict 时 return false;测试断言点击 b.md 条目仅写盘 b.md、c.md 保持 conflict、活动标签未被牵动 |
| F4 竞态严密 | workspace.ts:177-206:先 readTextFileRaw(:183),失败/null → 保持 Conflict + error 通知;成功后重查目标仍 conflict(:197-199)才落 content/savedContent/Clean;读盘期间切标签按 path 决策不受影响,关标签 find 不到即放弃。EditorPane.vue:94 `detail.content ?? null` 消费携带内容免二次读盘(`??` 对空串正确);无 content 的外部变更链路(workspace.ts:142 reloadFromDisk(path))回退自读盘,既有行为不变 |

**结论二:正确性 —— pass**

- 无新 critical。既有用例仅 3 处因 resolveConflictUseDisk 签名异步化改为 await(verification.md R6 公开声明,断言意图不变,非悄悄改变);R2 全量 214/214 = 基线 201 + 13 新增,只增不减。
- unhandled rejection 排查:resolveConflictUseDisk 全部异常路径在 try/catch 内,Banner 侧 `void` 调用安全;keepMine 内部原有 try/catch。
- 完成声明探测三键:stale_state 无(验证于 06e9134,其后 fe679f2 仅改 .planning 文档,亲核 `git diff 06e9134..HEAD --stat`);dirty_worktree 无(`git status --porcelain` 空);misleading_success_output 无(装配测试断言落在写盘参数与调用次数上,非空转)。
- 对抗检查后不立案两项(记录理由):①onBlur 已开始的 async 保存循环无法被关闭瞬间中断——物理窗口毫秒级且 clearRetries 已断后续重试,规范场景 9 意图为「关闭后不产生新保存」,onBlur 入口 :157 已满足;②useAutoSave 在无 scope 环境下 stopEnabledWatch 不随 dispose——与既有 stop watch 同模式,生产装配在 HomeView setup 内必有 scope,测试均经 dispose 清理。

**结论三:代码库一致性 —— pass**

- 修复注释统一带「修复 F2/F3/F4」标记可追溯至评审账本;Banner 模板 container→row 拆分沿用既有 BEM 类名(`__row`),样式迁移无残留死类;测试组织(真实 store + mock service + fake timers + flushPromises)与既有 watch.test/AutoSaveBanner.test 惯例一致。
- round 1 遗留 F5-F8(minor)维持 DEFERRED,不阻断;F6 注释漂移(EditorPane.vue:84-87 一带)本轮 EditorPane 改动未触碰该注释,仍在。

**验证摘要可信度抽查**:R3(装配测试)已亲跑复核 PASS;R4/R5/R6 的断言经 diff 通读确认真实(调用参数/标签状态/通知文案/事件 detail),与「已 PASS 不重跑」原则一致未重跑;R1 vue-tsc 0 错为声明采信(4 个修复提交各自提交前复跑,有过程记录)。



### 处置账本追加(round 1 修复轮,append-only)

> 修复轮对上方 F1-F8 的处置记录;上方原表行保留不动(append-only)。evidence 行号以修复后 HEAD = 06e9134 为准。

| # | severity | disposition | evidence | decided_by | round |
|---|----------|-------------|----------|------------|-------|
| F1 | critical | FIXED | 装配:src/views/HomeView.vue:49 `useAutoSave()`(setup 调用,onScopeDispose 随组件清理);回归:src/views/HomeView.autosave.test.ts 3 例(开→写盘/关→不写盘/卸载→清理);commit 071cfad | coordinator | 1 |
| F2 | major | FIXED | src/composables/useAutoSave.ts:116(重试回调入口复查开关)、:146(防抖到点回调复查)、:185-193(开关联动 watch:关闭即 cancelPending+clearRetries,dispose 同步停 watch);测试:「防抖已安排后关闭开关…」「重试链等待期关闭开关…」「重试回调先于 watch 生效…」3 例;commit 52e0a1f | coordinator | 1 |
| F3 | major | FIXED | src/components/AutoSaveBanner.vue:17(conflictTabs 列表)、:56、:64(按钮传各自 tab);src/stores/workspace.ts:148、:177(决策 action 支持按 path);测试:「多标签冲突:横幅逐标签渲染,按钮只作用于各自标签」;commit 464e90f | coordinator | 1 |
| F4 | major | FIXED | src/stores/workspace.ts:177-206(先读盘,成功且同一标签仍 conflict 才置 Clean;失败保持 Conflict+error 通知)、:111(reloadFromDisk 携 content);src/components/EditorPane.vue:94(消费携带 content,免二次读盘);测试:workspace.watch.test.ts 真 clean 5 例(含读盘失败保持冲突、读盘期间切标签/关标签)+ AutoSaveBanner 读盘失败保持横幅;commit 06e9134 | coordinator | 1 |
| F5 | minor | DEFERRED | saveAllDirty 死代码不在本修复轮清单,留待下一阶段顺手清理 | coordinator | 1 |
| F6 | minor | DEFERRED | EditorPane reload 注释漂移,本轮未触碰该注释,留待文档清理 | coordinator | 1 |
| F7 | minor | DEFERRED | isRetryable 全局 lastSaveError 耦合,本轮未动;继续观察 | coordinator | 1 |
| F8 | minor | DEFERRED | watchFileExternal unlisten 泄漏(PRE-EXISTING),超出本修复轮清单,建议下一阶段修复 | coordinator | 1 |

### 处置账本追加(round 2 复审,append-only)

> 第 2 轮对 F1-F4 修复的独立复审裁定;上方 round 1 原表行保留不动。行号以 HEAD = fe679f2 为准(= 06e9134,代码未再变)。

| # | severity | disposition | evidence | decided_by | round |
|---|----------|-------------|----------|------------|-------|
| F1 | critical | VERIFIED(维持 FIXED) | HomeView.vue:49@fe679f2 setup 装配 + useAutoSave.ts:195-206 onScopeDispose 清理;装配测试亲跑 3/3 PASS(2.08s),真实链路非自我循环 | reviewer | 2 |
| F2 | major | VERIFIED(维持 FIXED) | useAutoSave.ts:147(防抖回调复查)+ :117(重试回调复查)+ :186-193(关闭瞬间 watch 撤销)+ :157(onBlur 入口,既有);runAutoSaveRound 两调用入口均已堵,无旁路;极端时序有用例兜底 | reviewer | 2 |
| F3 | major | VERIFIED(维持 FIXED) | AutoSaveBanner.vue:17/:56/:64@fe679f2 文案与按钮同源各 tab;workspace.ts:148/:177-178 按 path 决策;多标签用例断言只作用各自标签 | reviewer | 2 |
| F4 | major | VERIFIED(维持 FIXED) | workspace.ts:177-206@fe679f2 先读盘后落 Clean,失败/null 保持 Conflict;:197-199 竞态重查(切标签/关标签);EditorPane.vue:94 消费携带 content 免二次读盘,外部变更链路 workspace.ts:142 行为不变;5 例真 clean 测试断言真实 | reviewer | 2 |
| F5-F8 | minor | DEFERRED(维持) | 复审确认本轮修复未触及 F5-F8 区域,无恶化;随下一阶段清理 | reviewer | 2 |
| F9+ | — | 无新发现 | 新 critical 0;新 non-critical 0(两项对抗疑点经取证不立案,理由见第 2 轮结论二) | reviewer | 2 |
