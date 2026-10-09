---
add: 007
slug: cheatsheet-expand
title: 语法速查内容扩充(28 → 55 条)
status: reviewed
created_at: 2026-10-09
chapter: chapter-01(并入,add-006 同域)
contract_version: 0.3.1 → 0.3.2(patch,纯内容,无行为变化)
review_verdict: approved(第 2 轮;首轮 1 critical 已修)
---

# add-007:语法速查内容扩充

## 需求

用户:「对语法速查进行补全,显示的语法示例太少了!」——add-006 六域 28 条覆盖面不足,
扩充到 ~55 条,UI 与交互零变化。

## 落点判定

chapter-01(并入),add-006 同域续作,无需判定流程。

## 契约(纯内容,无新端点/事件)

- `openapi.yaml` 0.3.1 → **0.3.2**(patch);Clarifications 追加 add-007 Q/A
- `event-flow.md`:add-006 节内追加「速查内容扩充(add-007)」小节:内容铁律
  (只收渲染得出的语法;kUML 仅官方验证构造三来源)+ 各节条目下限

## 内容扩充计划

| 节 | 现有 | 目标 | 新增 |
|----|------|------|------|
| markdown-basics | 12 | 17 | 粗斜体、多级引用、嵌套列表、引用式链接、转义字符(计划原列「指定语言代码块」,实现时改为「粗斜体」——围栏代码块 add-006 已含语言标注说明) |
| gfm-extended | 5 | 6 | 裸网址自动链接 |
| math(KaTeX) | 3 | 12 | 上下标、分数、根号、求和/积分/极限、希腊字母、矩阵、自适应定界符、多行对齐 aligned、方程组 cases、公式内文字(10 新增,计划列 9) |
| mermaid | 3 | 8 | 状态图、ER 图、饼图、甘特图、思维导图 |
| plantuml | 3 | 7 | 活动图、状态图、注释 note、生命线激活 |
| kuml | 2 | 5 | 关联修饰(多重性/聚合,README 验证)、时序图(llm 页验证)、C4 系统上下文(官方 examples 验证,需 import) |

## 实现方式

主会话直接实现(裁剪理由同 add-003/004,评审员复核):单文件内容扩充 + 测试哨兵更新,
无架构面;官方验证材料(kUML 三来源)已在主会话上下文,worker 派发的简报成本高于实现本身。

## 验证与评审

- **主会话 fresh evidence**:pnpm typecheck exit 0;pnpm test **380/380**(哨兵原地改写,
  用例数与 add-006 基线同);哨兵首跑曾误报 `processPayment(`——实为官方示例消息
  label 字符串,修正为扫描前剥离字符串字面量
- **ql-reviewer 第 1 轮:`criticals_found`**(1 critical + 3 non-critical;评审员实证
  mermaid 11.4.0 / KaTeX throwOnError / remark-gfm 语义;报告留档
  `.qiling/planning/build/add-007-review.md`):
  - **C1(已修)**:mermaid-mindmap description 声称 mindmap 可用 `[( )]` 形状
    (实证仅 flowchart 支持,照抄 parse 报错)→ 文案改为实证支持的 [方形]/{{六边形}}
  - N1(DEFERRED):**KaTeX 渲染管线未接线**(pipeline 无 math 插件、src 零 katex
    import),数学节 12 条当前展示语法但预览不渲染——继承自 add-006 的域声明
    (README 路线图 Phase 3),待数学公式支持 add 立项
  - N2(已修):3 条新 kUML 条目补齐「choco install kuml」CLI 提示,节内 5 条一致
  - N3(已同步):立项卡计划表与实际条目差异(见上表修正说明)+ 卡内待填节补全
- **第 2 轮复审:`approved`**(0 critical;评审员实证新文案形状集与探针 PARSE-OK
  集合相符、kUML CLI 提示逐字一致、变更面无越界;复跑 380/380 + typecheck exit 0)
- 评审方式说明:评审员独立抓取三个官方来源逐字比对白名单(18 构造无多收无漏收)

## 章节同步

- chapter-01:附录 A.7「add-007 增量留档:速查内容扩充」+ 附录 C.4 变更日志追加
- 索引 docs/README.md:契约版本口径 v0.3.1 → v0.3.2(端点数不变,纯内容)

## 下一步

/ql-deliver(交付)。
