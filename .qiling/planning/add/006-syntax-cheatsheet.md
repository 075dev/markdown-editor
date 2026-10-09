---
add: 006
slug: syntax-cheatsheet
title: 应用内语法速查面板
status: reviewed
created_at: 2026-10-09
chapter: chapter-01(并入,自动判断)
contract_version: 0.3.0 → 0.3.1(patch,纯前端行为约定文档化,无新端点/事件)
review_verdict: approved(第 1 轮,0 critical / 2 non-critical)
---

# add-006:应用内语法速查面板

## 需求

用户:「添加语法说明,用于速查语法」——写作时快速查用编辑器支持的各类语法。
解读为**应用内速查面板**(非仓库文档文件):六域条目(Markdown 基础 / GFM 扩展 /
数学 KaTeX / mermaid / PlantUML / kUML),名称 + 语法示例 + 一句话说明,
关键词过滤 + 一键复制。内容打包内置,离线可用。

## 落点判定

**chapter-01(并入),自动判断**,证据:编辑器核心 UX 能力(与 add-002/add-005
同章先例);chapter-02=自动保存、chapter-03=主题系统,均无主题重合。

## 契约(纯前端,无新端点/事件)

- `openapi.yaml`:0.3.0 → **0.3.1**(patch);Clarifications 追加 add-006 Q/A
- `event-flow.md`:追加「语法速查面板约定(add-006)」节(时序图 + 行为细则 6 条 +
  边缘场景表 7 行)。要点:F1/标题栏/右键菜单三入口;模态浮层 role=dialog,
  Esc 关闭焦点归还,仅拦截 F1/Esc/Tab(其余全局快捷键不受影响);kUML 示例仅用
  官方 README 验证过的构造(禁止臆造);复制复用 writeClipboard;
  v1 只读(不自动插入编辑器,延后)

## 实现方式

派发 1 个 ql-builder-worker(纯前端单域,无并行收益;add-005 协调器嵌套派发
不可用的结论仍有效,主会话直派)。

| 交付 | 内容 |
|------|------|
| 内容 | src/data/syntaxCheatsheet.ts(6 节 28 条;kUML 仅官方 README 验证构造) |
| 开关 | src/composables/useSyntaxCheatsheet.ts(模块级单例 + 焦点归还) |
| 组件 | src/components/SyntaxCheatsheetModal.vue(搜索/复制反馈/焦点陷阱/Esc/遮罩关闭) |
| 接线 | HomeView.vue(F1 全局分支 + 挂载,+37 行)、TitleBar.vue(「?速查」按钮)、main.ts(右键菜单项) |
| 测试 | 4 个新文件 27 例(内容完整性/防臆造哨兵/组合式状态机/组件行为/F1 装配) |

已申报偏离:遮罩点击额外支持关闭浮层(契约外补充,与 ContextMenu「点外面关闭」
惯例一致,评审确认合理无误关路径)。

## 验证与评审

- **主会话 fresh evidence**:pnpm typecheck exit 0;pnpm test **380/380**(基线 353
  + 新增 27);pnpm build PASS(11.79s)
- **ql-reviewer 第 1 轮:`approved`**(0 critical / 2 non-critical;报告留档
  `.qiling/planning/build/add-006-review.md`;评审员复跑 380/380 + typecheck 与
  worker 声明一致;契约合规/正确性/代码库一致性三结论全 pass):
  - **N1(已闭环)**:kUML 第 2 条 `attribute(name = "status", type = status)`
    疑未经验证 → 主会话此前抓取的官方 README 原文逐字含该行(注释
    "enum val used as attribute type"),构造获验证,无需改动
  - **N2(已修复)**:gfm-table 描述「连字符至少三个」过严(GFM 单个 `-` 亦可)
    → 文案改为「每个列至少一个连字符(-)」
- 环境限制:pnpm lint 因 @eslint/js 缺失不可跑(预存,基线同样,本增量禁装依赖)

## 章节同步

- chapter-01:附录 A.6「add-006 增量留档:应用内语法速查面板」+ 附录 C.4 变更日志追加
- 索引 docs/README.md:契约版本口径 v0.3.0 → v0.3.1(端点数不变,纯前端无新端点)

## 下一步

/ql-deliver(与 add-005 同分支一并交付)。
