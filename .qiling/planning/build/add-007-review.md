---
verdict: approved(第 2 轮;第 1 轮为 criticals_found,历史见正文)
reviewed_at: 2026-10-09T21:45:00+08:00
round: 2
reviewed_range: 25d3868..working-tree(ql/add-007-cheatsheet-expand,未提交)
inputs:
  - openapi.yaml(0.3.2 diff)
  - event-flow.md(add-007 小节 diff)
  - add/007-cheatsheet-expand.md(立项卡,当计划读)
  - 亲自取证:官方三来源(GitHub README.adoc Quick Start / kuml.dev/llm / docs/examples/kuml-getting-started.kuml.kts)已逐一抓取比对;mermaid 11.4.0 / katex 0.16.11 / remark-parse+remark-gfm 4 本地实证探针;pnpm typecheck;pnpm test
---

# add-007 独立评审报告(语法速查内容扩充 28 → 55)

## 裁定:`criticals_found`(1 critical / 3 non-critical;均为一行级修复,内容主体质量高)

---

## 结论一:契约合规 — pass(附 1 处铁律反例,计入 critical)

| 验收项 | 结果 | 证据 |
|--------|------|------|
| 条目 28 → 55(17/6/12/8/7/5) | ✅ | syntaxCheatsheet.ts 实数 17(40-143)/6(148-185)/12(190-263)/8(268-317)/7(322-365)/5(370-411);测试哨兵同步 syntaxCheatsheet.test.ts:35-49 |
| openapi.yaml 0.3.1 → 0.3.2 + Clarification 追加 | ✅ | openapi.yaml diff:version 0.3.2;Clarification add-007 Q/A 与实际条目数、铁律、白名单哨兵表述一致 |
| event-flow.md add-007 小节(铁律 + 三来源 + 下限) | ✅ | event-flow.md diff(451-457 行附近);与 openapi Clarification 数字一致,无内部矛盾 |
| kUML 白名单哨兵落地,三来源精确一致 | ✅ | 哨兵实现 syntaxCheatsheet.test.ts:69-110;**三来源逐一抓取核对**:README.adoc Quick Start(L47-78)= classDiagram/classOf/enumOf/literal/attribute/operation/association + aggregation = AggregationKind.COMPOSITE + source/target { multiplicity(spec) } + role,且原文注释 "no imports needed" 证实条目的「无需 import」;kuml.dev/llm PaymentFlow 示例 = sequenceDiagram/lifeline/message/reply,kuml-sequence snippet 为其逐字子集(含 label = "processPayment(order)",测试注释所述属实);docs/examples/kuml-getting-started.kuml.kts = import dev.kuml.c4.dsl.*/c4Model/person/softwareSystem/relationship/systemContextDiagram/include。白名单 18 项与三来源调用形构造**恰好相等**(无多收、无漏收);AggregationKind/role/description/technology 为属性赋值不跟「(」,出哨兵范围,test 注释已声明该口径 |
| 内容铁律「只收渲染得出的语法」 | ❌ 1 反例 | mermaid-mindmap description 声称 mindmap 可用 `[( )]` 形状(syntaxCheatsheet.ts:314)——mermaid 11.4.0 实证 parse 报错(见结论二 C1)。其余 54 条:mermaid 8 条全部 parse 通过、KaTeX 12 条全部 throwOnError 通过、markdown/GFM 逐条语义实证、PlantUML 4 新条标准语法、kUML 5 条官方来源验证 |
| UI/交互零变化 | ✅ | diff 仅动 src/data/syntaxCheatsheet.{ts,test.ts} + 两份契约文档;SyntaxCheatsheetModal/PreviewPane 未触碰 |
| ==高亮== 等渲染不出语法未混入 | ✅ | grep `==` 仅命中文件头注释的反例说明(syntaxCheatsheet.ts:9);55 条中无 remark-gfm 不支持的构造 |

**实现方式裁剪复核:** 单文件数据 + 测试哨兵更新、无架构面,主会话直接实现合理,予以确认。

---

## 结论二:正确性 — fail(1 critical)

### C1(critical)mermaid-mindmap description 教了一个 mindmap 不支持的形状 `[( )]`,照抄后渲染报错

- **证据(实证):** mermaid 11.4.0(与 package.json 一致)parse 探针:mindmap 下 `[ ]`/`( )`/`(( ))`/`{{ }}`/`))((`/`) (` 六种形状全部 PARSE-OK;`a[(文本)]` **PARSE-FAIL**(jison 报错)。圆柱 `[( )]` 是 flowchart 专属,mindmap 官方形状集没有它。
- **位置:** syntaxCheatsheet.ts:314 —— `root((文字)) 是中心圆形节点,[( )] 等形状语法与流程图一致。`
- **影响:** 用户照 description 在 mindmap 里写 `[( )]` → mermaid parse error → 预览回退源码块 + console 警告(services/mermaid.ts:125-128 失败路径),违反 add-007 铁律「只收编辑器渲染得出的语法」。snippet 本身(`root((Markdown))`)实证通过,仅 description 一句话有错。
- **修法(一行):** 删去「[( )] 等」或改为真实存在的形状(如 `))(( `、`{{ }}`)。

### 其余正确性取证(全绿)

| 域 | 方法 | 结果 |
|----|------|------|
| markdown 5 新条(bold-italic/nested-quote/nested-list/ref-link/escape) | remark-parse + remark-gfm 4 本地渲染探针 | em+strong / 三级 blockquote / ul 嵌 ol / 定义行配对成功解析出两个 `<a>` / `\* \# \`` 原样输出 — 全部 PASS |
| gfm-www | 同上 + 代码核对 | `https://` 与 `www.` 均自动成链(www 补 http:// 前缀);remark-gfm autolinkLiteral 生效,pipeline.ts:90 确实挂载 |
| KaTeX 9 新条(sub-sup/frac/sqrt/calculus/greek/matrix/delimiters/aligned/cases/text) | katex 0.16.11 renderToString + throwOnError,逐公式体 | 12 条 17 个公式体全部 PASS(含 `\text{中文}`、pmatrix、cases、aligned、\left\right 配对、\sqrt[3]);TS 字符串转义核对:`\\\\` → 文本 `\\` 作矩阵/对齐换行符,`\\*` → `\*` 作转义,均正确 |
| mermaid 5 新条(state/er/pie/gantt/mindmap) | mermaid 11.4.0 parse 探针(模拟 services/mermaid.ts initialize 配置) | 全部 PARSE-OK(含中文状态名、`||--o{`/`||--|{` 基数、`dateFormat`+`after a1`、mindmap 缩进层级);gantt 任务行与官方文档格式 `:a1, 2026-10-01, 7d` 一致 |
| PlantUML 4 新条(activity/state/note/activate) | 标准语法知识比对(activity 新语法 start/:动作;/if-then-else-endif/stop;note...end note;activate/deactivate) | 全部为 PlantUML 标准构造,无臆造;@startuml/@enduml 成对 |
| kUML 白名单哨兵实现 | 代码审读 + 绕过推演 | 字符串剥离正则 `/"(?:[^"\\]|\\.)*"/g` 正确处理转义引号,先剥离后扫描使官方 label `processPayment(order)` 不误报;`source {`/`target {` 块形与 `aggregation = AggregationKind.COMPOSITE` 属性赋值天然不在扫描范围(test 注释声明一致);`import dev.kuml.c4.dsl.*` 无 `(` 不触发;哨兵 fail-closed(白名单外任何 `标识符(` 即失败),对臆造构造有效 |
| description ↔ snippet 一致性 | 通读 | gfm-table 保留 add-006 N2 修正(:152);kuml-class/enum 保留 CLI 提示(:375/:383);kuml-c4 说明 import 必要性且 snippet 首行即 import(:407-409),与官方示例一致(C4 需 import、类图域无需,README 原文注释证实) |

### AI 代码套路扫描(S1-S8):已扫 8 条,命中 0 条

S1 mock 冒充实现(N/A:纯静态数据模块即设计本身)、S2 路由未接线(N/A 无端点;数据由既有 SyntaxCheatsheetModal 消费)、S3 吞错误(diff 无 catch)、S4 全 200(N/A 无网络面)、S5 契约字段未消费(id/title/description/snippet 均被既有 modal/测试消费)、S6 测试只测 mock(哨兵断言的是导出数据的真实不变量,非 mock 交互)、S7 占位残留(grep TODO/FIXME/placeholder/临时/示例数据:无命中)、S8 校验只在文档里(白名单 + 条目下限均有代码级哨兵,test.ts:35-110)。

### 复跑数字(本评审亲自跑)

- `pnpm typecheck` → **exit 0**
- `pnpm test`(vitest run)→ **42 文件 / 380/380 PASS**,6.5s(与 add-006 后基线同为 380:本轮哨兵是原地改写无新增用例,与变更描述一致)

---

## 结论三:代码库一致性 — pass(2 条 non-critical)

- 六节数据结构 `{id,title,description,snippet}`、命名(md-*/gfm-*/math-*/mermaid-*/puml-*/kuml-*)、中文说明口吻、文件头设计要点注释格式,均与 add-006 既有风格连续(全文比对 syntaxCheatsheet.ts:36-413)。
- 测试文件注释块同步更新哨兵意图,describe/it 命名与既有风格一致(test.ts:1-10)。
- gfm-autolink description 同步收窄为「仅尖括号」(:170),与新增 gfm-www 分工明确,无自相矛盾。

---

## 处置账本(append-only)

| # | 发现 | severity | disposition | evidence | decided_by | round |
|---|------|----------|-------------|----------|------------|-------|
| F1 | mermaid-mindmap description 声称 `[( )]` 形状,mindmap 不支持,照抄 parse 报错 | critical | OPEN(修法:改 syntaxCheatsheet.ts:314 一句话,如改列 `))(( `/`{{ }}` 或删该从句) | mermaid 11.4.0 parse 探针 + syntaxCheatsheet.ts:314 | ql-reviewer | 1 |
| F2 | KaTeX 渲染栈未接线(pipeline 无 remark-math/katex,src 无 import),math 节 12 条当前编辑器实际渲染不出;math-inline 所述「公式开关」在 src 中不存在 | non-critical(继承自 add-006:契约已把「数学(KaTeX 行内/块)」列为六域之一,add-006 评审已批;README 明示 katex「计划 Phase 3 接入」) | DEFERRED → 建议登记:Phase 3 接线 KaTeX 后本条自动闭合,或届时修 math-inline 文案 | src/markdown/pipeline.ts:85-105(无 math 插件)、grep src 无 katex import、README.md:12 | ql-reviewer | 1 |
| F3 | 新增 3 条 kUML(association/sequence/c4)无 CLI 安装提示,与节内前 2 条(有 choco install kuml 提示)不一致 | non-critical | OPEN(可选:三新条 description 补同一句提示) | syntaxCheatsheet.ts:391/:399/:407 ↔ :375/:383 | ql-reviewer | 1 |
| F4 | 立项卡「内容扩充计划」列 markdown 新增「指定语言代码块」,实际改为「粗斜体」(```js 围栏 add-006 已有);卡内「验证与评审/章节同步」仍待填 | non-critical | OPEN(deliver 前同步立项卡即可;契约只锁条目数,不锁主题) | add/007-cheatsheet-expand.md:32/:44-50 ↔ syntaxCheatsheet.ts:66-69 | ql-reviewer | 1 |

## 复审提示

C1 为一行文案修复;修复后仅需复审 syntaxCheatsheet.ts:314 一行 + 重跑 `pnpm test`(哨兵不覆盖 description 语义,建议顺手在 mermaid 节加一条 description 不含 `[( )]` 的断言防复发,可选)。

---

# 第 2 轮复审记录(2026-10-09T21:50:00+08:00)

## 裁定:`approved`(最终)

> 第 1 轮结论按历史记录原样保留于上文;本节为最终裁定。

## 修复核对

| # | 发现 | 声明修复 | 核对结果 | 证据 |
|---|------|----------|----------|------|
| F1 | C1:mindmap description 声称 `[( )]` 形状(parse 报错) | 改为「root((文字)) 是中心圆形节点,节点形状另支持 [方形]、{{六边形}} 等。」 | ✅ FIXED | syntaxCheatsheet.ts:314;全文 grep `\[(` 零命中;新声称的 `[方形]`/`{{六边形}}` 恰为第 1 轮 mermaid 11.4.0 探针实测 PARSE-OK 的两种形状(square/hexagon),「等」涵盖 ( )/))((/)( 亦实测通过——新文案与实证形状集完全相符,无新反例 |
| F2 | N1:KaTeX 管线未接线(继承 add-006) | 不修代码,登记 DEFERRED(写入立项卡与 STATE) | ✅ DEFERRED(按第 1 轮建议处置) | 处置见立项卡/STATE 补全;不影响本增量交付 |
| F3 | N2:新增 3 条 kUML 无 CLI 提示 | 三条补同一句提示 | ✅ FIXED | syntaxCheatsheet.ts:391/:399/:407 与 :375/:383 措辞逐字一致,节内 5 条全部带「渲染需本机安装 kuml CLI(choco install kuml),未装时预览保留源码」 |
| F4 | N3:立项卡计划主题偏差 + 待填节 | 留档补全时同步 | DEFERRED(交付前置项,不阻断) | add/007-cheatsheet-expand.md:32/:44-50 |

## 无越界改动核对

- 变更面与第 1 轮完全一致:同 4 文件,diff stat 248/25 不变;test.ts diff 未再变动(+/- 64 行含围栏头,与第 1 轮一致)
- 条目计数未动:全文 61 处 `id: '`(55 条目 + 6 节)

## 复跑数字(第 2 轮,本评审亲自跑)

- `pnpm test -- --run` → **42 文件 / 380/380 PASS**,6.0s
- `pnpm typecheck` → **exit 0**

## 最终裁定

**approved** — C1/F1、N2/F3 已修复并核实;N1/F2、N3/F4 按 non-critical 处置登记,不阻断交付。遗留提醒:deliver 前完成 F4 立项卡同步(含 N1 DEFERRED 登记),候选防复发断言(mermaid 节 description 不含 `[( )]`)为可选优化。
