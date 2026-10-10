---
add: 008
slug: cheatsheet-complete
title: 语法速查全域完整化(55 → 97 条)
status: reviewed
created_at: 2026-10-09
chapter: chapter-01(并入,add-006/007 同域)
contract_version: 0.3.2 → 0.3.3(patch,纯内容,无行为变化)
review_verdict: approved(第 2 轮;首轮 2 critical 已修)
---

# add-008:语法速查全域完整化

## 需求

用户:「既然我们做了,那么就做全部的所有语法的速查」——从精选扩充升级为**全域完整**
覆盖:编辑器渲染得出的全部语法域的常用全集。

## 落点判定

chapter-01(并入),add-006/007 同域续作。

## 契约(纯内容,无新端点/事件)

- `openapi.yaml` 0.3.2 → **0.3.3**(patch);Clarifications 追加 add-008 Q/A
- `event-flow.md`:add-006 节内追加「速查全域完整化(add-008)」小节:
  **收录标准(完整化边界)**——常用全集而非 API 全表(KaTeX 16 类高频组;
  mermaid 实验性渲染器以 node 探针实证为准;PlantUML 小众扩展不收;kUML
  收常用 10 图型,小众型标注边界);各节目标 markdown 23 / gfm 8 / 数学 28 /
  mermaid 15 / plantuml 13 / kuml 10;kUML 第四官方来源 docs/diagram-types.adoc,
  白名单哨兵扩至 39 构造

## 实现方式

派发 1 个 ql-builder-worker(单文件内容工作,量大约 42 条新增;mermaid 条目要求
worker 以 node 探针自证 parse 通过后才收录,评审员复证)。

## 验证与评审

- **主会话 fresh evidence**:pnpm typecheck exit 0;pnpm test **380/380**(哨兵原地
  改写);pnpm build PASS(9.46s)
- **worker 自证**:mermaid 8 候选全部 node 探针 PARSE-OK(16 条收录,超目标 1,契约
  已同步);PlantUML 甘特简报建议写法「[任务1] is 5 days」被 worker 经官方服务实证
  HTTP 400 弃用,改 lasts/then/happens at 写法;quadrantChart/requirementDiagram/
  xychart-beta 采用引号包裹变体(中文不引号词法报错)
- **ql-reviewer 第 1 轮:`criticals_found`**(2 critical + 5 non-critical;四路实证:
  KaTeX 28 条零报错 / mermaid 16/16 parse OK / PlantUML 7 条官方服务 HTTP 200 /
  kUML 5 条与 diagram-types.adoc 逐字一致;报告留档
  `.qiling/planning/build/add-008-review.md`):
  - **C1(已修)**:md-inline-html 条目声称 b/em/kbd/sub/sup 预览生效——评审员真实
    管线实证 **raw HTML 被整体丢弃**(hast-util-sanitize 5.0.2 无 raw 分支,预存
    行为)→ 按铁律整条移除,markdown 23 → 22,哨兵/契约同步
  - **C2(已修)**:puml-mindmap 描述「**_ 表示右侧」语义错(PlantUML 官方服务
    A/B 实证:右侧为默认方向,_ = 无边框)→ 文案纠正 + snippet 改含 left side
    写法(第 2 轮 SVG 几何实证左侧分支 x=20/27 < 根 x=118)
  - N1(已同步)契约数字 22/8/28/16/13/10=97;N2(记录)kUML 部署图为官方样本
    子集(删一行 artifact,零臆造);N3(已同步)暂缓清单补 object/package;
    N4(记录)白名单通用名窄绕过面,可接受;N5(已落账)STATE 交付时登记
  - N6/N7(已修)头注释滞后、mermaid 哨兵 15→16;N8(见下)
- **第 2 轮复审:`approved`**(0 critical;复跑 380/380 + typecheck exit 0)

## DEFERRED 登记(交付后跟踪)

1. **KaTeX 渲染管线接线**(继承 add-007):数学节 28 条展示语法但预览不渲染公式;
   README 路线图 Phase 3。
2. **Markdown 内嵌 HTML 支持**(add-008 新登记):如需支持,须给 sanitize 管线接
   raw 分支重解析(hast-util-sanitize 5.0.2 无 raw 分支),建议独立 add/bugfix 立项。
3. **kUML 小众图型补录**:timing/communication/interaction-overview/
   composite-structure/profile/object/package 官方 adoc 有样本,按需走同一流程。

## 章节同步

- chapter-01:附录 A.8「add-008 增量留档:速查全域完整化」+ 附录 C.4 变更日志追加
- 索引 docs/README.md:契约版本口径 v0.3.2 → v0.3.3(端点数不变,纯内容)

## 下一步

/ql-deliver(与 add-007 同分支链式交付:add-007 已落账 a35b8cf,add-008 在其上)。
