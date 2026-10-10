---
ql_version: '0.20.0'
ql_state_version: '1.0'
current_phase: '1_shipped'
chapter_id: chapter-02
docs_path: .qiling/docs/
work_branch: ql/add-008-cheatsheet-complete
base_sha: bc234d254c727c66814b2cf22d8ec8661ac7093c
status: shipped
review_verdict: approved
review_rounds: 2
reviewed_range: bc234d2..5fa1686
waves_executed: 4
last_activity: add-007(速查 55 条)+ add-008(速查全域完整化 97 条)shipped via PR #3(6c1ffdb,契约 0.3.3,380/380 + build 9.46s,双增量评审各 2 轮 approved,待人工合并,2026-10-09)
skeleton_endpoints: 11
skeleton_events: 1
waves_executed: 2
api_endpoints_count: 13
event_messages_count: 1
---
# 项目状态

## 当前位置
阶段: 1 (讨论完成,契约待用户最终确认 → /ql-build)

## 本阶段范围
**自动保存 + 冲突安全网**(README 路线图 Phase 2 唯一明确未完成项):
- IPC 契约正式化:11 个端点(6 个现有 command + 5 个文件服务能力)
- 行为增量:防抖 1500ms 自动保存、失焦即存、失败指数退避重试
- 冲突安全网:标签页状态机 Clean/Dirty/Conflict + file-external-change 决策

## Clarity Breakdown(冻结门,2026-09-14)
| 维度 | 评分 | 依据 |
|------|------|------|
| 目标清晰度 | 9 | 端点清单 11 个无"或/待定";范围一句话可说清 |
| 约束清晰度 | 8 | 错误模型、防抖时长、触发时机、备份策略、冲突语义全部确定;认证/分页不适用 |
| 验收清晰度 | 8 | 每端点输入→输出明确;自动保存可观察(mtime 变化);冲突双按钮可观察 |
| **ambiguity** | **0.16** | ≤ 0.2,允许冻结 |

实体收敛:首轮讨论即定稿(OpenFileResult/SaveFileResult/DirEntry 复用现有代码命名,无抖动)。

## Assumptions Exposed(默认假设,后续阶段可否决)
- A1: 错误响应 `{code, message}` 为目标态;现有 Rust `Result<_, String>` 构建时映射(已入宪法 C4)
- A2: `file-external-change` payload 增加 `kind: modified|removed` 为目标态;现状仅 `{path}`
- A3: 自动保存延时固定 1500ms;设置页仅提供开关,不做延时调节 UI
- A4: 无路径标签(untitled)不参与自动保存,仅手动另存为
- A5: Conflict 态允许继续编辑,仅暂停该标签的自动保存
- A6: 5 个文件服务端点(open/save/new/pick-dir/list-dir)维持插件直调现状,不强制迁入 Rust command(封装于 services 层即满足宪法 C1)

## 澄清记录
- 2026-09-14 阶段范围 → 自动保存+冲突安全网(首轮 AskUserQuestion 未获回答,Never-Ask 降级自决推荐项)
- 2026-09-14 冲突策略 → 冲突态用户选(保留我的/用磁盘版本)
- 2026-09-14 触发时机 → 防抖 1500ms + 失焦即存
- 2026-09-14 备份 → 不留 .bak

## 项目背景
- markdown-editor:Tauri 2 + Vue 3 + CodeMirror 6 本地优先 Markdown 编辑器
- 文档树: .qiling/docs/(chapter-01 为 ql-scan 初始化快照)
- 现有 IPC 面: 6 个 tauri command + 1 个事件(file-external-change)
- 产出: .planning/context/{openapi.yaml, event-flow.md, constitution.md}

## 缺陷修复(不推进 phase)
- bugfix-001(2026-09-15): 默认打开方式启动时不打开文档 —— 状态 fixed,评审 approved(0 critical)。修复 a5582d4:冷启 argv 暂存 + take_startup_open_path + HomeView 启动打开 + fileAssociations 打包声明。遗留:暖启动 argv 转发(N2,建议 tauri-plugin-single-instance)、安装级双击实测(N3)。详见 .planning/bugfix/001-file-association-open.md
- bugfix-002(2026-09-15): 安装后仅首次能打开、关闭后再也打不开 —— 状态 fixed,评审 approved(0 critical/0 major)。根因:自研 lockfile 单实例锁误判"句柄释放时 OS 删除文件",锁残留挡死二次启动。修复 7a3a53a:改 tauri-plugin-single-instance 2.4.4(OS 原生 mutex),顺带闭环 bugfix-001 遗留 N2(暖启动 argv 转发)。遗留 4 项 minor(emit 竞态/插件窗口期/测试锁定缺口/分隔符边缘)。详见 .planning/bugfix/002-single-instance-lock-stuck.md
- bugfix-003(2026-09-28): 文档链接跳转把未保存内容覆盖为磁盘版本(目标为空文件时呈现为「跳转到空文档」)—— 状态 fixed,评审 approved(0 critical/3 non-critical)。根因:openFileFromPath 对已打开的 dirty 标签无条件 upsertTab 覆盖,违反冲突安全网原则;自动保存默认关闭放大触发面。修复 6db9b3f:guardDirtyTab 守卫(openFileFromPath + openFile 双入口),命中 dirty → conflict/modified 由用户决策;回归 PreviewPane.links-e2e.test.ts 6 例(全量 317/317),真机 CDP 终验通过。遗留:空文件跳转语境提示(UX)、newFile 对话框覆盖边缘(PRE-EXISTING)。详见 .planning/bugfix/003-link-jump-overwrites-unsaved.md
- bugfix-004(2026-09-28): 白名单外位置的工作区,文件树(含子目录中的 MD 文件)整体索引失败 —— 状态 fixed,评审 skipped(ql-fix 流程)。根因:capabilities 的 fs:scope 只静态放行 $HOME 等四个固定位置,任意位置工作区在 plugin-fs readDir 被整体 forbidden 且异常被静默吞掉(read_file 为自定义 command 不走 scope,故打开单文件一直正常)。修复 c129e97:新增 allow_workspace_dir 命令(fs_scope().allow_directory 递归运行时授权),chooseWorkspace 读目录前调用;回归 workspace.tree-scope.test.ts 3 例(全量 320/320),真机 CDP 终验通过。遗留:allow_workspace_dir 未写入 openapi 契约(契约刷新时补)、文件树失败 UI 提示(DEFERRED)。详见 .planning/bugfix/004-workspace-fs-scope-forbidden.md
- bugfix-005(2026-10-09): 文件关联双击/暖启动/链接跳转打开的文件无法保存(打开正常、保存恒 forbidden)—— 状态 fixed,评审 skipped(ql-fix 流程)。根因:这类文件不经对话框/chooseWorkspace 授权,plugin-fs writeTextFile 被 fs:scope 拒绝(read_file 自定义 command 不受限,形成"能开不能存"不对称)。修复 5fa1686:allow_workspace_dir 分支文件语义(fs_scope().allow_file)+ openFileFromPath 打开前 best-effort 授权;回归 workspace.open-scope.test.ts 2 例(全量 337/337),真机暖启动端到端终验通过。已随 v0.2.0 发布。遗留:saveTab/resolveConflictKeepMine 双重 normalizeError 降级码(DEFERRED)。详见 .qiling/planning/bugfix/005-file-open-scope-save-forbidden.md

## 功能追加(add)
- add-001(2026-09-15): 六主题 + 全面视觉升级 → 新建 chapter-03,评审 approved(1 major 已修)。详见 .planning/add/001-theme-system.md
- add-002(2026-09-21): 文档链接跳转 → 并入 chapter-01(§1.5),评审 approved(0 critical)。/ipc/open-external 新端点 + headingAnchors slug 插件 + 预览链接三分支路由(全分支 preventDefault);测试 235→311。遗留 4 minor DEFERRED。详见 .planning/add/002-doc-links.md
- add-003(2026-09-28): 预览正文染色主题 → 并入 chapter-03(§1.5,用户确认落点),评审 approved(2 轮,首轮 1 critical 已修)。纯前端:contentTheme 偏好(follow/paper/sepia/parchment/night,默认 follow)+ --content-* 内容语义层(11 变量)+ 预览区元素切换 + 设置页下拉;契约 0.2.1(仅行为约定);测试 320→327。遗留:parchment blockquote 对比度按评审方案 #665a40 闭环。详见 .planning/add/003-content-theme.md
- add-004(2026-09-28): markdown 语法染色主题 → 并入 chapter-03(§1.6,add-003 方向纠正后新增),评审 approved(2 轮,首轮 1 critical 已修)。纯前端:syntaxTheme 偏好(follow/rainbow/academic/mono,默认 follow)+ --syntax-* 语法语义层(12 变量,标题 1-6 级分色 + 行内代码/粗体/斜体/删除线/链接/列表)+ 编辑器源码高亮与预览渲染同驱动 + 设置页下拉;围栏代码块不属本层(:not(pre)>code 限定);契约 0.2.2(仅行为约定);测试 327→335。详见 .planning/add/004-syntax-theme.md
- add-005(2026-10-09): kUML 图表语法支持(https://kuml.dev)→ 并入 chapter-01(附录 A.5,自动判断:预览渲染域),评审 approved(1 轮,0 critical / 5 non-critical,N1 sanitizer 加固已修)。新端点 /ipc/render-kuml(Rust 探测 kuml CLI + 临时 .kuml.kts + 60s 超时)+ mermaid 式客户端渲染(services/kuml.ts,FNV-1a 源码缓存,零依赖 DOMParser SVG 清洗)+ stripDiagramCode += kuml + PreviewPane 步骤 4;契约 0.2.2→0.3.0;测试 337→353 + cargo 17/17。发现既有缺陷:mermaid 选择器 pre.language-mermaid>code 对真实管线输出命中 0(静默失效,候选 bugfix-006)。真实 CLI 端到端待用户环境。详见 .qiling/planning/add/005-kuml-support.md
- add-006(2026-10-09): 应用内语法速查面板 → 并入 chapter-01(附录 A.6,自动判断:编辑器核心 UX),评审 approved(1 轮,0 critical / 2 non-critical,N1 经官方 README 原文闭环、N2 文案已修)。纯前端:F1/标题栏「?速查」/右键菜单三入口,六域 28 条(Markdown/GFM/KaTeX/mermaid/plantuml/kUML,数据测试含 kUML 防臆造哨兵)+ 关键词过滤 + 一键复制(writeClipboard);role=dialog/焦点陷阱/Esc 归还,浮层仅拦 F1/Esc/Tab;契约 0.3.0→0.3.1(patch);测试 353→380。详见 .qiling/planning/add/006-syntax-cheatsheet.md
- add-007(2026-10-09): 语法速查内容扩充 28→55 条 → 并入 chapter-01(附录 A.7,add-006 同域续作),评审 2 轮 approved(首轮 1 critical:mermaid-mindmap 描述声称不支持的 [( )] 形状,实证后修文案)。Markdown 17/GFM 6/数学 12/mermaid 8/plantuml 7/kUML 5;kUML 白名单哨兵(18 构造,三官方来源:README Quick Start/kuml.dev/llm/官方 examples);契约 0.3.1→0.3.2(patch);主会话直接实现(评审复核裁剪合理)。DEFERRED:KaTeX 渲染管线未接线(数学节展示语法但预览不渲染,README 路线图 Phase 3,待立项)。详见 .qiling/planning/add/007-cheatsheet-expand.md
- add-008(2026-10-09): 语法速查全域完整化 55→97 条 → 并入 chapter-01(附录 A.8,add-006/007 同域续作),评审 2 轮 approved(首轮 2 critical 已修:①md-inline-html 条目经真实管线实证 raw HTML 被整体丢弃后按铁律移除,②PlantUML 思维导图「**_ 表示右侧」文案纠正,SVG 几何实证)。收录标准=常用全集:Markdown 22/GFM 8/数学 28(16 类高频组)/mermaid 16(8 新渲染器全部 node 探针 PARSE-OK)/plantuml 13/kUML 10(diagram-types.adoc 第四官方来源,白名单 39 构造);契约 0.3.2→0.3.3(patch);worker 实现(mermaid 探针自证 + PlantUML 甘特语法实证纠错)。DEFERRED:KaTeX 接线、内嵌 HTML 支持(sanitize raw 分支)、kUML 小众图型补录。详见 .qiling/planning/add/008-cheatsheet-complete.md
