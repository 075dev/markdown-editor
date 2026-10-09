---
verdict: approved
reviewed_at: 2026-09-21T22:30:00+08:00
round: 1
reviewed_range: 9339b1c..9d55aed (契约 3432a0b 先行 + 实现 9d55aed)
waived_by:
waive_reason:
inputs:
  - openapi.yaml (v0.2.0)
  - event-flow.md (add-002 节)
  - constitution.md
  - add-002-verification.md
  - add-002-fill-report.md
  - decisions.md 不存在(契约 Clarifications 两条 add-002 Q/A 即设计意图记录)
review_tier: STANDARD(15 文件 +1342 行,超 LIGHT;未触 auth/**/schema/**;因触及"Rust 白名单防前端绕过"安全面,对该面额外做对抗检查)
---

# 独立评审报告(第 1 轮)—— add-002 文档链接跳转

## 裁定:`approved`

0 个 critical,5 个 non-critical(N1-N5,均不阻断)。diff 通读完毕;A1-A4(主会话 fresh PASS)未重跑;A6(worker 代跑)已由评审者亲跑 `cargo test` 复核 6/6 PASS。三条结论独立成立。

---

## 结论一:契约合规 —— **pass**

### 1a. IPC 契约(openapi.yaml)

| 契约项 | 结果 | 证据(亲核) |
|--------|------|------|
| 新端点 /ipc/open-external 注册 | ✅ | src-tauri/src/lib.rs:167(generate_handler 收录 open_external) |
| 协议白名单 http/https/mailto 大小写不敏感,白名单外不传 shell | ✅ | lib.rs:454-460(`to_ascii_lowercase` + `starts_with`,fail-closed:前导空格/裸串均拒);open_external_tests 3 例,评审者亲跑通过 |
| 错误码 UNSUPPORTED_PROTOCOL / OPEN_EXTERNAL_FAILED,Rust "CODE: message" 前缀 | ✅ | lib.rs:468、:470-471(同 read_file:443 先例);errors.ts:19-20(union)+ :35(CODE_PREFIX_RE)同步收录;契约 enum openapi.yaml:395-396——三处逐字对齐 |
| Web 降级 window.open(target,'_blank','noopener') | ✅ | externalLinks.ts:30-36(isTauri() else 分支;null → 抛错);宪法 C2 合规 |
| 响应体 {ok: true} | ⚠️ | Rust `Result<(), String>` 序列化为 `null`,非 `{ok:true}`——但与既有 watch_file(:360)/open_diagram_window(:214)完全同款(均 `Ok(())`),前端不消费响应体,记 N1(non-critical) |

### 1b. 行为契约(event-flow.md 场景 4 + 细则 1-4 + 边缘场景表)

| 验收项 | 结果 | 证据(亲核) |
|--------|------|------|
| 细则 1 四分支分类(大小写不敏感) | ✅ | linkResolution.ts:82-98;linkResolution.test.ts 全分支用例(含 `HTTP://` 大写、`#%E5%AE%89%E8%A3%85` 解码、非法编码容错);js/data/vbscript → ignored 用例齐 |
| 细则 2 路径解析(decode/剥锚点/盘符绝对/根相对/当前目录/补 .md/失败提示) | ✅ | linkResolution.ts:147-181;rootPath 缺失 → null(测试锁定)、盘符正反斜杠归一、中文 decode、`.gitignore` 不重复补扩展名;PreviewPane.links.test.ts 断言 missing.md → saveNotice error 且 activeTab 不动 |
| 细则 3 heading slug id(GitHub 风格/CJK 保留/-N 去重/sanitize 前注入) | ✅ | headingAnchors.ts:47-58(slug 规则)+ :63-90(每次 process 独立去重空间,防跨文档泄漏——有专门用例);pipeline.ts:103 挂载于 rehypeSanitize 前;渲染集成测试 5 例含「sanitize 后 id 存活」关键锁定 |
| 细则 4 Web 降级(open-external → window.open;文档跳转 → 提示仅桌面) | ✅ | externalLinks.ts:30-36;PreviewPane.vue:73-77(`!isTauri()` → saveNotice,测试断言 readTextFile 未被调) |
| 所有分支一律 preventDefault | ✅ | PreviewPane.vue:38(preventDefault 先于分支);PreviewPane.links.test.ts 每分支均断言 `event.defaultPrevented === true` |
| 边缘场景表 9 条 | ✅ | anchor 平滑滚动(:57-61 scrollIntoView smooth/start)、目标不存在静默、javascript 双保险、missing.md、open-external 失败 → OPEN_EXTERNAL_FAILED 提示、Web 相对路径提示——均有对应用例且断言落在行为上 |
| 无新事件(x-ql-events 不变) | ✅ | openapi.yaml diff 未触碰 x-ql-events;event-flow.md add-002 节自述"无新事件" |

## 结论二:正确性 —— **pass**

### 重点对抗检查(任务卡关注点逐项)

1. **open_external 白名单绕过面:未发现可构造绕过。** 前导空格(`" https://…"`)不匹配前缀 → 拒绝(fail-closed);`cmd /c calc`、`file:`、`data:` 均有测试锁定拒绝;`open` crate 走 `ShellExecuteW` 直调,不经 cmd 解析,无注入面。嵌入 NUL 的理论构造最坏在 Win32 边界截断为目标串前缀(`http:`),无法换成白名单外协议;且前置防线有两层——sanitize 默认 href 协议白名单 `['http','https','irc','ircs','mailto','xmpp']`(亲探 hast-util-sanitize@5.0.2 schema.js:141-146,javascript:/data: 的 href 属性被整条剥离)+ 前端分类 ignored。Rust 侧二次校验对"前端被攻破"场景成立。
2. **事件委托内存/重复注册:无问题。** onMounted 注册一次(PreviewPane.vue:99-104)、onBeforeUnmount 配对移除(:177-180);v-html 重渲只替换容器子节点,容器本体与监听器不重建——委托恰是为此设计;watchEffect 内既有 plantuml/img 绑定不在本次 diff 且有 dataset 标志守卫,与新委托无冲突(plantuml 容器内无 `<a>`)。
3. **resolveDocumentHref `..` 越界/空段:边界正确。** 纯字符串消解(linkResolution.ts:108-142):盘符根的 `..` 忽略不丢盘符(测试 `C:\a\b.md + ../../.. → C:\x.md`);相对基准跳不出的 `..` 原样保留 → 交由读盘失败兜底(不会拼出非法盘外路径);空段与 `.` 跳过;越界结果最坏是读盘失败 → 状态栏提示,无崩溃路径。本地单人文档场景 `..` 逃逸出工作区不构成新攻击面(read_file 命令本就接受任意路径,存量语义)。
4. **anchor 枚举 × sanitize 交互:成立。** 亲探 defaultSchema:`id` 确在 `attributes['*']` 全局白名单、`clobberPrefix` 默认 `'user-content-'`——pipeline.ts:37-41 注释声称的机制**准确**;真正的放行动作是 `clobberPrefix: ''`,且有 5 条渲染集成测试锁定 id 存活。`clobberPrefix: ''` 同时放开 raw HTML 的 `name`/`id` 不加前缀(DOM clobbering 面),本地单人文档可接受且 worker 已自报为风险 #1,多租户场景需重估——记 N3 关联观察。
5. **saveNotice 复用:无回归。** store 字段为既有(warehouse workspace.ts:99),AutoSaveBanner.vue:72-82 对 message 原样透传、error 级手动关闭,与自动保存 info 级定时清除互不干扰;链接错误写入的 `{level:'error'}` 不触碰 lastSaveError/重试链路。
6. **测试断言真实性:成立,非 mock 空转。** PreviewPane.links.test.ts 用真实 store + 仅 mock IO 边界(fileService.readTextFile/openExternal),断言落在 `defaultPrevented`、`readTextFileMock` 收到的解析后绝对路径、`ws.tabs`/`activeTabPath`/`saveNotice` 内容;headingAnchors 集成测试走真实 renderMarkdown 管线;Rust 测试断言纯函数返回值。

### AI 代码套路扫描(S1-S8):**已扫 8 条,命中 0 条**

| # | 套路 | 结果 | 证据 |
|---|------|------|------|
| S1 | mock 冒充实现 | ✅ 未命中 | open_external 真调 `open::that`(lib.rs:470);openFileFromPath → fileService.readTextFile 真读盘(workspace.ts:489-494);生产代码无硬编码假数据 |
| S2 | 路由未接线 | ✅ 未命中 | command 已注册(lib.rs:167);PreviewPane 真实挂载(HomeView.vue:8、:141);handler 全分支有实现体 |
| S3 | 吞错误 | ✅ 未命中 | externalLinks.ts catch → 重抛 QlError;PreviewPane external/document 两分支均有 .catch/.then(!ok) 通知;Rust map_err 带码。anchor 目标不存在静默为契约明文(边缘场景"忽略,无报错") |
| S4 | 全 200 综合征 | ✅ 未命中 | 契约 422/500 两码在 Rust 白名单失败/系统调用失败两分支各有产出;前端 union + 前缀正则 + 测试三面锁定 |
| S5 | 契约字段未消费 | ✅ 未命中 | `target` required/minLength 1 → 空串/裸串被白名单拒绝(rejects_bare_string_without_protocol 含 "") |
| S6 | 测试只测 mock | ✅ 未命中 | 见上文"测试断言真实性";无"仅断言 service 被调用"的用例 |
| S7 | 占位残留 | ✅ 未命中 | diff 新增行 grep `TODO\|FIXME\|placeholder\|lorem` = 0(lib.rs:637 "placeholder handle" 为存量,不在本次 hunk 内);diff 内 `console.` 新增 = 0 |
| S8 | 校验只在文档里 | ✅ 未命中 | 白名单/路径解析/根相对前置检查均为代码层实现并有失败路径测试 |

## 结论三:代码库一致性 —— **pass**

- **C1(MUST)pass**:本次新增 Tauri API import 仅在 src/services/(externalLinks.ts 动态 import);PreviewPane 一律经 `@/services/env|externalLinks|errors`。非 services 命中仅 plantumlRehype.ts(PRE-EXISTING,上轮已登记)。
- **C2(MUST)pass**:openExternal 有 isTauri 分支 + noopener 注释。
- **C3(MUST)pass**:headingAnchors 在 pipeline.ts:103 挂载于 rehypeSanitize 之前(未绕过管线);`clobberPrefix: ''` 有注释论证 + 集成测试锁定;diff 新增 console = 0。
- **C4(SHOULD)pass**:新 command 错误按 `"CODE: message"` 前缀(同 read_file 先例),未新增裸字符串穿透;errors.ts 三处对齐。
- **C5(SHOULD)观察**:`.qiling/docs/chapters/`(3 章)尚无 open-external 字样——add-002 未交付,章节同步按惯例在交付阶段(ql-doc)执行,当前未构成"漂移超过一阶段"。记 N5。
- 命名与结构:linkResolution 纯函数零依赖置于 src/markdown/(与 stripDiagramCode 同型);测试文件位置/vi.mock 惯例/forceTauri 辅助与既有 PreviewPane.test.ts、fileService.save-errors.test.ts 一致;lib.rs 模块注释风格同 read_file 段。

## 验证摘要可信度

- **A1-A4(主会话 fresh PASS)**:未重跑,符合"已 PASS 不重跑"原则;A3 chunk>500kB 警告确认为存量(mermaid 体积),非本次引入。
- **A6(worker 代跑)→ 评审者亲跑复核**:`cargo test`(src-tauri)= **6 passed; 0 failed**(open_external_tests 3 + startup_open_tests 3),与摘要一致,证据缺口已闭合。
- **A5(NOT_RUN PRE-EXISTING)**:@eslint/js 缺失为上轮已确认的存量环境缺口,维持 PRE-EXISTING 定性。
- **完成声明三键探测**:stale_state 无(验证于 9d55aed = 当前 HEAD,其后无代码提交);dirty_worktree 无(`git status --porcelain` 仅 2 个未跟踪 .planning 报告,评审者自建探针文件已即建即删);misleading_success_output 无(抽查断言均为行为级,见结论二)。
- **PRE-EXISTING 项复核**:lint 通道损坏、health_url dead_code、chunk 警告、plantumlRehype.ts C1 例外——均不在 9339b1c..9d55aed 范围内,与本次无关。

## Non-critical 发现(账本)

| # | 发现 | severity | disposition | evidence | decided_by | round |
|---|------|----------|-------------|----------|------------|-------|
| F1 | /ipc/open-external 200 响应体为 `null`,契约写 `{ok: true}`;系沿袭 watch_file/open_diagram_window 的既有惯例差(均 `Ok(())`),前端不消费响应体,无功能影响。后续宜统一一侧(契约注现状或 Rust 返回 {ok:true}) | non-critical | DEFERRED | lib.rs:466-471 vs openapi.yaml:308-316、lib.rs:214/:360 同款 | — | 1 |
| F2 | classifyPreviewLink 不 trim 前导空白,`" javascript:…"` 理论落 document 分支;实际不可达(CommonMark 剥目的地址首尾空白 + sanitize 已剥该 href 属性),即便到达也仅读盘失败提示、不触 shell。加固级备注 | non-critical | DEFERRED | linkResolution.ts:82-86(仅 trim 判空);schema.js:141-146(协议白名单) | — | 1 |
| F3 | raw HTML 非 heading 元素的显式 id 不进 headingAnchors 去重空间,可与生成 slug 撞出重复 id;anchor 命中取 document-order 首个,可能滚到非标题元素。本地单人文档无害,与 `clobberPrefix: ''` 同属本地信任模型 | non-critical | DEFERRED | headingAnchors.ts:74-86(仅对 h1-h6 计数);PreviewPane.vue:57-60(querySelectorAll('[id]') 首个匹配) | — | 1 |
| F4 | 文件名含 `#` 的文档链接(`my#file.md`)按首个 `#` 切 fragment → 解析为 `my.md`;与 GitHub 渲染行为一致,契约未覆盖,读盘失败有状态栏兜底 | non-critical | DEFERRED | linkResolution.ts:66-71(splitFragment) | — | 1 |
| F5 | C5 章节留档:.qiling/docs/chapters 尚未含 add-002(open-external/锚点),交付阶段(ql-doc)需同步,当前漂移 < 1 阶段不违宪 | non-critical | DEFERRED | grep open-external .qiling/docs/ = 空;chapters 仅 chapter-01~03(止于 add-001) | — | 1 |

## 复审记录(round ≥ 2 时)

第 1 轮,无上期待复审项。
