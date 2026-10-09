---
add: 003
slug: content-theme
title: 预览正文染色主题
status: reviewed
created_at: 2026-09-28
chapter: chapter-03(并入)
contract_version: 0.2.0 → 0.2.1(patch,纯行为约定文档化)
---

# add-003:预览正文染色主题

## 需求

「新增 markdown 文本染色主题」。经 AskUserQuestion 澄清(两问均用户确认):语义 = **预览正文染色主题**——针对预览区正文元素(标题/正文/引用/链接/表格/代码底色)的独立配色方案集,可独立于 UI 主题选择(护眼米黄/纸张/羊皮纸/夜间内容等);落点 = **并入 chapter-03**(与 add-001 主题系统同域,用户确认)。

## 落点判定

用户确认(AskUserQuestion):chapter-03。证据:与 add-001 六主题/CSS 变量 token 体系强相关(同一知识域),零契约重合属纯前端能力——参照 add-001 先例。

## 契约(纯前端,无新端点/事件)

- `openapi.yaml`:0.2.0 → **0.2.1**(patch);Clarifications 追加 add-003 Q/A;顺带补 bugfix-004 的 allow_workspace_dir 约定行(闭环其契约遗留)
- `event-flow.md`:追加「正文染色主题约定(add-003)」节(flowchart + 行为细则 5 条 + 边缘场景表 5 行)

## 实现(主会话直接实现,未派发波次)

**裁剪理由**:7 文件强单域耦合(CSS 变量名是 store/CSS/视图三方共享契约),310 行,零 IPC 面——拆波次无并行收益,评审员确认裁剪合理。

| 文件 | 变更 |
|------|------|
| src/stores/settings.ts | CONTENT_THEMES/ContentTheme/标签/isContentTheme/resolveContentTheme(非法回落 follow)+ PersistedSettings.contentTheme + load() 四处默认 + applyContentTheme(follow 移除属性)+ watch 持久化 + setContentTheme/resetAll |
| src/styles/global.css | 内容语义层(--content-* 11 变量,默认映射 UI token)+ paper/sepia/parchment/night 四套覆盖(每套 11 变量) |
| src/components/PreviewPane.vue | 正文区元素(bg/text/heading/blockquote/code/pre/table/hr/plantuml/mermaid)切换 --content-*;新增 .markdown-body a 链接色(显式化) |
| src/views/SettingsView.vue | 外观组新增「正文染色」select(data-testid=content-theme-select,5 方案) |
| src/stores/settings.content-theme.test.ts | 新增 7 例单测 |

## 验证与评审

- 定向 7/7;全量 **327/327**(基线 320 净增 7);typecheck/build PASS
- **ql-reviewer 第 1 轮:`criticals_found`**(1 critical + 3 non-critical):
  - **C1**:`--content-hr` 默认误映射 `--border-strong`,follow 模式违反"逐像素等价 add-001"(主会话曾误读 HEAD 值,评审员以 git show 核实为 `--border`)→ 修为 `var(--border)`
  - **N1**:"链接此前为浏览器默认蓝"表述失实(实为全局 a 规则染 accent)→ 修正 event-flow 第 4 条与 PreviewPane 注释
  - **N2**:sepia text-2 4.27 / parchment text-2 3.78 低于 WCAG AA → 加深为 #6b6149 / #6e6147
  - **N3**:verification 留档缺失 → 已补记
- 第 2 轮复审:见下方复审记录

## 复审记录

- **第 2 轮 verdict:`approved`**(0 critical)。C1 已解决(--content-hr 默认 = var(--border),follow 11 项映射逐像素等价 add-001);N1 已解决(注释与契约描述更正)。
- 遗留 non-critical 2 项:N2 parchment blockquote(text-2 on quote-bg)4.24 略欠 AA → 复审后主会话按评审建议把 text-2 深化为 **#665a40**(评审给出的精确方案);N3 verification 补记 → 已写入 `.planning/build/verification.md`(add-003 验证记录 A1-A6),随本提交落地。

## 章节同步

- chapter-03:§1.5「正文染色主题(add-003 增量)」+ §五 变更日志追加
- 索引:chapter-03 章节内增量,索引结构无变化(frontmatter 未变)
