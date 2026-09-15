---
ql_state_version: '1.0'
current_phase: '1_shipped'
chapter_id: chapter-02
docs_path: .qiling/docs/
work_branch: ql/phase-1-autosave
base_sha: bc234d254c727c66814b2cf22d8ec8661ac7093c
status: shipped
review_verdict: approved
review_rounds: 2
reviewed_range: bc234d2..fe679f2
waves_executed: 4
last_activity: shipped PR #1 + chapter-02 generated (用户选择:创建 PR)
skeleton_endpoints: 11
skeleton_events: 1
waves_executed: 2
api_endpoints_count: 11
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
