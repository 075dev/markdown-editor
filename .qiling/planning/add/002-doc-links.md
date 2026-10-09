# add-002 文档链接跳转 —— 交付台账与独立评审

日期:2026-09-21 | 分支:ql/phase-1-autosave | 范围:`9339b1c..<文档提交 HEAD>`(契约 + 实现 + 文档)| 模式:sequential(3 worker 串行,主会话协调)

## 落点判定(工作流步骤 2 记录)

- **方式:自动判断(用户未指定 `--at`),唯一匹配,未询问**
- 结论:**并入 chapter-01**
- 证据:① 预览渲染管线(pipeline.ts)与链接点击属 chapter-01 §1.4 前端核心域;② 复用既有 FileIO 域 `/ipc/read-file` 端点与 `openFileFromPath` 既有能力;③ 与 chapter-02(自动保存/冲突)、chapter-03(主题)零契约重合;④ 业务主题上"文档链接"是编辑器核心阅读/导航能力,chapter-01 即 markdown-editor 核心
- 功能解释依据:用户输入"完善文档连接功能"按编辑器语境收敛为**文档链接跳转闭环**——现状缺口三处有客观证据:预览 `<a>` 零点击处理(Tauri WebView 内点击会导航冲掉编辑器,bug 级)、标题无锚点 id(`#锚点` 不可用)、无文档间相对链接跳转。非目标(未做,可后续 add):Ctrl+K 插入链接、文件路径自动补全、wiki 链接、死链校验、图片相对路径解析

## 主报告

### 范围与提交

| 提交 | 内容 |
|------|------|
| 3432a0b | 契约:openapi.yaml 0.1.1→0.2.0(/ipc/open-external + 2 错误码)+ event-flow.md 场景 4/细则/边缘表;YAML 经 js-yaml 校验 |
| 9d55aed | 实现:T1 open_external command + externalLinks service;T2 headingAnchors 插件 + clobberPrefix;T3 linkResolution + PreviewPane 委托 + errors.ts 新码。13 文件 +1233/-5 |
| <文档提交> | 章节(chapter-01 §1.5/§五)+ 索引 + 台账 + STATE |

### 构建

- 协调器嵌套派发被环境阻断(子代理无再派发工具,零副作用返回);主会话承担协调职责,T1 → T2 → T3 顺序派发 ql-builder-worker(文件交错,T1 的 externalLinks.test.ts 被 T3 二次触碰,故单实现提交保证提交点自洽可验证)
- 测试 235 → **311**(+76:externalLinks 5、headingAnchors 19、linkResolution 40、PreviewPane.links 12、Rust open_external_tests 3,减 rust 侧重复计数以 vitest 口径为准)

### 声明(来源 add-002-verification.md,主会话亲测 fresh evidence)

- pnpm typecheck ✅ | pnpm test **311/311** ✅(4.20s)| pnpm build ✅ 7.71s | cargo check ✅(1 存量 warning)
- cargo test 6/6(worker 执行,**评审者亲跑补证** 6 passed)
- lint NOT_RUN(PRE-EXISTING:@eslint/js 缺失,与 phase-1 同源)

---

## 独立评审(第 1 轮,ql-reviewer 全新上下文,报告:.planning/build/add-002-review.md)

**verdict: approved** —— critical:0;non-critical:5(N1-N5,全 DEFERRED)

| 结论 | 结果 | 要点 |
|------|------|------|
| 契约合规 | pass | 端点注册、白名单 fail-closed、错误码三处逐字对齐(契约 enum/Rust 前端 union)、细则 1-4 与边缘场景 9 条均有实现+行为级测试;唯一字面差 N1(`{ok:true}` vs 实际 null,与既有 watch_file 同款惯例差) |
| 正确性 | pass | 白名单前导空格 fail-closed、open crate 走 ShellExecuteW 无 shell 解析面 + sanitize href 协议白名单前置防线;事件委托挂载/卸载配对;`..` 消解盘符根钳制;**S1-S8 全未命中**;断言均为行为级非 mock 空转 |
| 代码库一致性 | pass | C1/C2/C3/C4 全过;C5 章节留档本次交付时同步(N5 闭环) |

评审关键取证:亲跑 cargo test 补证 A6(唯一 worker 代跑项);探针证实 hast-util-sanitize 默认 schema 源码(id 在全局白名单、真正拦路者是 user-content- 前缀);完成声明三键(stale_state/dirty_worktree/misleading_success_output)均无。

### Non-critical 摘要

- N1 `{ok:true}` 响应体惯例差(command 返回 null)——与既有端点惯例一致,DEFERRED
- N2 分类器不 trim 前导空白——实际不可达(href 属性值非自由文本),加固备注
- N3 raw HTML 显式 id 可与 slug 撞名 + anchor 取首个匹配——边缘,记录
- N4 文件名含 `#` 会被按 fragment 切分——边缘,记录
- N5 C5 章节留档同步——本次交付闭环(FIXED,见下)

## 处置账本(append-only)

| 编号 | 级别 | 处置 | 证据 | decided_by | round |
|------|------|------|------|-----------|-------|
| N1-N4 | minor/备注 | DEFERRED | 遗留登记:响应体惯例差、分类器 trim、显式 id 撞名、`#` 文件名切分 | main-session | 1 |
| N5 | minor | FIXED | chapter-01 §1.5/§五 + 索引 README 增量合并 + STATE 更新(本次文档提交) | main-session | 1 |
| fill-report 自报风险 1-5 | 备注 | DEFERRED | clobberPrefix 安全面、白名单外协议落 document 分支、反斜杠归一假定 Windows、Web 模式判定、lint 存量损坏 | main-session | 1 |

## 下一步

/ql-deliver(交付:PR + 归档 + 索引终态)
