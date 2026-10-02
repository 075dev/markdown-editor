---
add: 004
slug: syntax-theme
title: markdown 语法染色主题
status: reviewed
created_at: 2026-09-28
chapter: chapter-03(并入)
contract_version: 0.2.1 → 0.2.2(patch,纯行为约定文档化)
---

# add-004:markdown 语法染色主题

## 需求

用户对 add-003 的方向纠正:「不是,主要是想要不同等级的主题不同的染色,`xx` 语法染色,`**xx**` 语法染色等功能」——即**语法元素的等级化配色**,并要求扩展到更多语法。经 AskUserQuestion 确认:

- **作用域**:编辑器源码 + 预览渲染(同一套变量驱动,两边观感一致),并扩展到标题等级/行内代码/粗体/斜体/删除线/链接/列表等全部语法;
- **形态**:可选方案集(与界面主题、正文染色三者正交)。

add-003 的整体内容配色**保留**为独立能力(用户当时确认的选项,与本次正交互补)。

## 落点判定

用户确认:chapter-03(与主题系统同域,延续 add-003)。

## 契约(纯前端,无新端点/事件)

- `openapi.yaml`:0.2.1 → **0.2.2**(patch);Clarifications 追加 add-004 Q/A
- `event-flow.md`:追加「语法染色主题约定(add-004)」节(flowchart + 行为细则 7 条 + 边缘场景表 8 行)

## 实现(主会话直接实现,未派发波次;裁剪理由同 add-003,评审员确认合理)

| 文件 | 变更 |
|------|------|
| src/stores/settings.ts | SYNTAX_THEMES(['follow','rainbow','academic','mono'])体系 + syntaxTheme 持久化 + applySyntaxTheme(follow 移除 data-syntax-theme)+ applyToDocument 6 参 + setSyntaxTheme/resetAll |
| src/styles/global.css | 语法语义层(--syntax-* 12 变量,follow 映射 content/UI token)+ rainbow/academic/mono 三方案覆盖 + cm-md-* 消费改造(heading-1..6 分色/bold/italic/strike 新增) |
| src/editor/markdownLanguage.ts | HighlightStyle 补 strikethrough tag(cm-md-strike,新增 line-through 装饰 = GFM 语义对齐) |
| src/components/PreviewPane.vue | h1-h6 各自 --syntax-hN(h1-h3 margin 规则保留)、行内代码(:not(pre)>code 限定)、strong/em/del、a、li::marker |
| src/views/SettingsView.vue | 「语法染色」下拉(data-testid=syntax-theme-select) |
| src/stores/settings.syntax-theme.test.ts | 新增 8 例单测 |

## 验证与评审

- 定向 8/8;全量 **335/335**(基线 327 净增 8);typecheck/build PASS
- **ql-reviewer 第 1 轮:`criticals_found`**(1 critical + 6 non-critical,评审报告留档 `.planning/build/add-004-review.md`):
  - **C1(作用域泄漏)**:`.markdown-body code` 未限定,围栏代码块(pre>code)被行内代码方案色染入 → 修为 `:not(pre) > code`
  - N1 变量计数 13→12(文档);N3 深色内容底 × 固定方案对比限制未入契约 → 边缘表补 2 行;N6 编辑器删除线 line-through 超出"恒等"承诺 → 细则第 7 条补约定(GFM 语义对齐的改善);N4 academic h5 × parchment 2.97:1 → non-critical 记录(已知组合限制覆盖);N5 验证留档 → 已补
- 第 2 轮复审:见下方复审记录

## 复审记录

- **第 2 轮 verdict:`approved`**(0 critical)。C1 已解决(`:not(pre) > code` 限定,行内代码覆盖面与代码块排除均经复核);契约修订(N1 计数 12/N3 边缘表 +2 行/N6 删除线约定)全部到位;评审员复跑 335/335 + vue-tsc exit 0。
- 评审报告留档:`.planning/build/add-004-review.md`(评审员自写,含两轮记录)。
- 遗留 non-critical:N4(academic h5 × parchment 组合 2.97:1,由"已知组合限制"边缘行覆盖语义,接受)。

## 章节同步

- chapter-03:§1.6「语法染色主题(add-004 增量)」+ §五 变更日志追加
- 索引:chapter-03 章节内增量,索引结构无变化
