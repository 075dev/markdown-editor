---
verdict: approved
reviewed_at: 2026-10-09T23:10:00+08:00
round: 2
reviewed_range: a35b8cf..<working-tree>(未提交;HEAD=a35b8cf,变更全在工作区)
inputs:
  - openapi.yaml(0.3.3,本变更内更新)
  - event-flow.md(速查全域完整化 add-008 小节,本变更内更新)
  - decisions.md(不存在,跳过)
  - verification.md(add-008 无独立小节;验证证据取自 add-008-fill-w1.md + 评审员复跑)
  - add-008-fill-w1.md
  - 评审档位:STANDARD(2 个 src 文件 + 3 个规划文件;未触安全/架构路径;内容正确性按任务卡要求做了对抗性实证)
---

# 独立评审报告 —— add-008 语法速查全域完整化(55 → 97 条)

## 最终裁定(round 2):`approved`

round 1 的 2 条 critical(F1/F2)与契约数字同步(N1/N3)已全部修复并经评审员独立实证;
复跑 `pnpm test -- --run` 42 文件 / **380/380** PASS、`pnpm typecheck` exit 0。
遗留 3 条 non-critical(N6 头注释滞后 / N7 mermaid 哨兵 15 vs 文档 16 / N8 raw-HTML DEFERRED
登记待落账),均不阻断。round 1 记录全文保留于下方历史小节。

## round 2 复审记录

### 上一轮 critical 处置

| # | 状态 | 说明 |
|---|------|------|
| C1 (F1) md-inline-html 描述与管线真实行为不符 | ✅ 已解决 | 处置 = **整条移除**(符合「只收渲染得出的语法」铁律):`grep md-inline-html` 数据 + 测试 0 命中;markdown-basics 实测 **22** 条,哨兵同步 22(test.ts:39,it 标题「22/8/28/15/13/10」);总条目实测 **97**;契约两侧(openapi Q/A「评审实证预览管线丢弃 raw HTML,内嵌 HTML 条目按铁律移除」+ event-flow 收录标准含根因「hast-util-sanitize 无 raw 分支——如需支持须另行立项」)已写入 |
| C2 (F2) puml-mindmap「**_=右侧」语义错误 | ✅ 已解决 | description 改为「分支默认画在右侧,left side 行之后画在左侧;节点加 _(如 **_)为无边框样式」(syntaxCheatsheet.ts:609,与 round 1 实证一致);snippet 改含 `left side`(ts:610)。评审员复证:官方服务 **HTTP 200 PARSE-OK**;SVG 几何 x 坐标:设计=20、图标=27 在根 Markdown=**118 左侧**,基础=260 / 标题=列表=358 在右 —— `left side` 语义与新文案精确吻合;`**_`=无边框沿用 round 1 A/B 实验(rects 3→2) |

### 契约同步核对(N1/N3)

| 项 | 状态 | 证据 |
|---|------|------|
| N1 数字同步 22/16/97 | ✅ | openapi.yaml add-008 Q/A:「55 → 97 条,markdown 22…mermaid 16…plantuml 13/kuml 10」;event-flow:「条目 55 → **97**」「各节条目…markdown 22 / gfm 8 / 数学 28 / mermaid 16 / plantuml 13 / kuml 10」;实测 awk/grep = 22/8/28/16/13/10 = 97 |
| N3 暂缓清单补 object/package | ✅ | event-flow add-008 小节:「…composite-structure/profile/object/package 小众/低优先型暂缓」 |

### 复跑(评审员亲自,round 2 工作区状态)

- `pnpm test -- --run`:42 文件 / **380/380** PASS(23:02:15,Duration 5.87s)
- `pnpm typecheck`:exit 0

### 新发现(round 2,均 non-critical)

| # | 问题 | 证据 |
|---|------|------|
| N6 | 两处头注释滞后于数据:syntaxCheatsheet.ts:7 仍写「共 98 条(add-008)」(实 97)、test.ts:6 仍写「add-008:23/8/28/15/13/10」(实 22) | grep/sed 实测 |
| N7 | event-flow 写「各节条目(测试哨兵同步)…mermaid 16」,test 哨兵 mermaid 仍为 **15**(其余五节哨兵=实际值);实际 16 条,哨兵少锁 1。建议下一触点把 test 最小值抬到 16 或调整文档措辞 | test.ts:42 vs event-flow add-008 小节 |
| N8 | raw HTML 管线支持的 DEFERRED 立项登记尚未落账(主会话已承诺写入;event-flow 已含「如需支持须另行立项」钩子),交付时补 | STATE.md 与 .qiling/planning/add/ 无对应条目 |

### 收敛判定

两轮无同类 critical 遗留,评审收敛,verdict 升级为 `approved`。

### 处置账本追加(round 2;round 1 账本见历史小节,append-only)

| # | 发现 | severity | disposition | evidence | decided_by | round |
|---|------|----------|-------------|----------|------------|-------|
| F1 | C1 md-inline-html 描述失实 | critical | FIXED(整条移除 + 哨兵 22 + 契约写明不收及根因) | grep 0 命中;test.ts:39;实测 22 条 | 修复方 | 2 |
| F2 | C2 puml-mindmap 语义错误 | critical | FIXED(改文案 + left side snippet) | syntaxCheatsheet.ts:609-610;HTTP 200 + x 坐标几何实证 | 修复方 | 2 |
| F3 | N1 契约数字滞后 | non-critical | FIXED(22/16/97) | openapi.yaml / event-flow diff | 修复方 | 2 |
| F5 | N3 暂缓清单漏 object/package | non-critical | FIXED | event-flow add-008 小节 | 修复方 | 2 |
| F8 | N6 头注释 98/23 滞后 | non-critical | OPEN | syntaxCheatsheet.ts:7;test.ts:6 | reviewer | 2 |
| F9 | N7 mermaid 哨兵 15 vs 文档/实际 16 | non-critical | OPEN | test.ts:42 | reviewer | 2 |
| F10 | N8 raw-HTML DEFERRED 登记待落账 | non-critical | OPEN(交付时由主会话补) | STATE.md 无条目 | reviewer | 2 |

---

# 以下为 round 1 历史记录

## 裁定(round 1):`criticals_found`

2 条 critical(均为**新增条目描述与编辑器真实渲染行为不符**,照抄后预览结果与文案承诺不一致),
5 条 non-critical。数据本体(98 条 snippet)经四路独立实证:KaTeX 28 条零报错、
mermaid 16/16 parse 通过、PlantUML 7 条官方服务 HTTP 200、kUML 5 条与官方
diagram-types.adoc 逐字一致;复跑 typecheck 0 错误、380/380 全绿。阻断项只在文案层,修复面小。

## 结论一:契约合规 —— pass(1 条文档数字滞后,non-critical)

| 验收项 | 结果 | 证据 |
|--------|------|------|
| 六节条目达下限 23/8/28/15/13/10 | ✅ | 实测 23/8/28/**16**/13/10 = 98;哨兵 `syntaxCheatsheet.test.ts:38-45`;评审员 awk 计数 + grep 总数 98 |
| mermaid 候选探针实证后才收录,失败即弃 | ✅ | 评审员独立 jsdom + mermaid.parse 探针:**16/16 PARSE-OK**(含 8 条既有回归与 quadrant/requirement/xychart 引号变体);fill 报告两轮探针记录与评审员结果吻合 |
| 数学取 16 类高频组非全表 | ✅ | 新增 16 条 `math-*`,评审员 katex.renderToString(throwOnError) 逐段渲染 **0 错误**(katex 0.16.11) |
| PlantUML 小众扩展(salt/archimate/ditaa)不收 | ✅ | diff 中无这些关键字段(全文 grep 无 salt/archimate/ditaa) |
| kUML 收常用 10 图型,小众型标注边界 | ✅ | 10 条(5 旧 + 5 新);每条 description 带边界说明(`syntaxCheatsheet.ts:672-703`);adoc 实测 14 UML 型 + 6 C4 小节,暂缓集合存在补录路径 |
| 白名单哨兵扩至 39 构造 | ✅ | `syntaxCheatsheet.test.ts:76-117`,18 + 21 = 39,与契约/event-flow 数字一致;新增 21 名全部逐字出自 diagram-types.adoc |
| 无新端点/事件,UI 零变化 | ✅ | diff 仅 2 个 src 数据/测试文件 + 规划文档;组件零改动 |
| gantt 写法偏离([任务] is N days 弃用) | ✅ 记录充分 | fill 报告偏离 #2(HTTP 400 实证);评审员复测 lasts/then/happens at 形式 → HTTP 200 |
| 契约/流程文档数字与实际一致 | ⚠️ | 契约与 event-flow 写 mermaid **15** / ~97,实际 **16** / 98(fill 报告偏离 #1 已自述,哨兵仍 15)。→ N1,non-critical |

## 结论二:正确性 —— fail(2 critical)

### Critical 发现

| # | 问题 | 证据 | 修复指引 |
|---|------|------|----------|
| C1 | `md-inline-html` 描述声称「b/em/kbd/sub/sup **在预览中生效**」,实际本项目管线**剥离全部内嵌 HTML**。评审员以真实 `renderMarkdown` 渲染该 snippet,输出为 `<p>加粗 强调 Ctrl+S 下标 上标</p>`——五个标签全被剥掉,只剩文本。根因(预存,非本变更引入):`pipeline.ts:91` allowDangerousHtml 产出 raw 节点,`pipeline.ts:104` 的 rehype-sanitize 6.0 直通 hast-util-sanitize 5.0.2,其 `lib/index.js` node-type switch **没有 `raw` 分支**(default 直接丢弃),故 defaultSchema.tagNames 放行 b/kbd/sub/sup 与追加 div/figure/figcaption 均不生效。安全半个声明(“script/iframe/onclick 被剥离不执行”)为真且过度满足——是全部标签都被剥 | 评审探针输出(临时 vitest,已删);`node_modules/.pnpm/hast-util-sanitize@5.0.2/.../lib/index.js:283-301`(switch 无 raw case);`src/data/syntaxCheatsheet.ts:162-165`(round 1 版本) | 二选一,主会话定:(a) 最小修复 = 改文案,如实写“预览净化会剥离内嵌 HTML 标签(含 b/kbd 等),只保留其中文本”;(b) 若要兑现“生效”,需给 sanitize 接入 raw 重解析,属行为变更另立项。注意 (a) 时该条目仍可保留但定位改为“HTML 会被净化”知识条目,或移除 |
| C2 | `puml-mindmap` 描述声称「`**_` 表示分支画在**右侧**」,实证语义错误:`_` 后缀 = **无框(boxless)节点**。评审员 PlantUML 官方服务 A/B 实验:baseline `** C` → 3 个圆角矩形;`**_ C` → 2 个矩形、文本 C 仍在(C 变无框)。右侧本就是 mindmap 默认方向,与 `_` 无关;真正控制左右的是 `left side` 关键字。照此文案用户会建立错误心智模型(以为 `_` 管方向) | 评审员 SVG 对比实验(HTTP 200,rects 3→2);`src/data/syntaxCheatsheet.ts:614-616`(round 1 版本);snippet 本身可正常渲染,仅描述语义错 | 改 `syntaxCheatsheet.ts:616`:「`**_` 表示无框节点;默认分支画在右侧,`left side` 关键字可将分支画到左侧」(或按用户理解裁剪)。与 add-007 首轮 critical(mermaid-mindmap 文案错)同类 |

### Non-critical 发现(round 1)

| # | 问题 | 证据 |
|---|------|------|
| N1 | 契约(openapi.yaml Clarification)与 event-flow 小节的条目数字滞后于实际:mermaid 15→16、总 ~97→98;哨兵下限也未同步抬到 16。偏差在 fill 报告偏离 #1 已如实记录且理由成立(探针全过才收),属文档收尾问题 | `openapi.yaml` add-008 Q/A 行;`event-flow.md` add-008 小节;fill 报告 L128-132 |
| N2 | kUML 部署图 snippet 是官方样本的**子集**:删除了 adoc 中第二行 `artifact(name = "kuml-mcp.jar")`。非构造改动、零臆造,记录备查 | diagram-types.adoc:196-205(官方仓库 kuml-dev/kUML@main 原文)vs `syntaxCheatsheet.ts` deploymentDiagram snippet |
| N3 | event-flow 暂缓清单(timing/communication/interaction-overview/composite-structure/profile)漏列 object/package 两个 V1.1 型(adoc 中同样有 DSL 样本、同样未收录),边界描述不完整 | diagram-types.adoc:113,152(V1.1 小节)vs event-flow.md add-008 小节 |
| N4 | 白名单含通用名 `node/state/action/edge/initial/final/component` 等:误拦风险为零(现有 10 条全部命中);漏拦风险 = 未来臆造构造若恰好只复用这些通用名可绕过哨兵——影响面限于 kUML 单节,且这 21 个名均逐字出自官方 adoc,属可接受残留,记录备查 | `syntaxCheatsheet.test.ts:96-117`;adoc 逐字核对 |
| N5 | `STATE.md` 工作区改动仍是 add-007 视角(“待交付”),尚未登记 add-008;属主会话交付阶段簿记,不计入本变更 | `git diff .qiling/planning/STATE.md` |

### AI 代码套路扫描(S1-S8,round 1)

| # | 套路 | 结果 | 证据 |
|---|------|------|------|
| S1-S6、S8 | mock 冒充/路由未接线/吞错误/全 200/契约字段未消费/测试只测 mock/校验只在文档 | 不适用 | 纯静态数据变更,无路由、handler、mock、schema 校验面 |
| S7 | 占位残留 | ✅ 未命中 | `grep TODO/FIXME/placeholder/lorem/临时/示例数据/XXX` 两文件 exit 1 |

### 测试成立性(round 1)

哨兵测试断言真实数据形状(条目数/id 唯一/围栏配对/白名单扫描),非“只断言 mock 被调用”;
字符串剥离正则 `/"(?:[^"\\]|\\.)*"/g`(`test.ts:123`)正确处理 `guard = "valid"` 与
`label = "processPayment(order)"` 场景。基线 380/380 未新增用例——本波次为纯数据,
数据侧实证由评审员四路探针补足(见下),可接受。

## 结论三:代码库一致性 —— pass

- 条目形状(id/title/description/snippet)、注释风格、中文标点与 add-006/007 既有 55 条完全一致。
- kUML 新 5 条沿用既有「choco install kuml,未装时预览保留源码」边界后缀惯例(旧 5 条 :5 处 → 新 10 条 :10 处,一一对应)。
- 测试沿用 add-007 哨兵模式,注释同步更新为四来源;契约 Clarification 行格式与既往 Q/A 一致。

## 验证摘要可信度(round 1)

- **抽查 worker 声明 typecheck + 380/380:评审员亲自复跑一致**——`pnpm typecheck` exit 0;`pnpm test -- --run` **42 文件 / 380 tests 全过**(Duration 6.23s)。声明可信。
- **fill 报告 mermaid 探针记录:与评审员独立复现一致**(16/16 PARSE-OK,引号变体结论相符)。
- **fill 报告 PlantUML 记录:与评审员独立复现一致**(7 条 HTTP 200 无 Syntax Error,含既有 sequence 回归)。
- PRE-EXISTING 复核:`pnpm lint` 不可跑(@eslint/js 缺失)确认预存,未再报;KaTeX 渲染管线未接线为 add-007 已登记 DEFERRED,数学节“展示语法但预览不渲染”不属本变更缺陷。verification.md 主文件停在 add-005/006 交付时点(7a2e899),add-008 交付时由主会话补登,非 worker 缺陷。

## 评审员实证命令清单(round 1,全部亲自跑)

1. jsdom + mermaid.parse:16/16 OK(含 8 条既有回归;quadrantChart/requirementDiagram/xychart-beta 引号变体过)
2. katex.renderToString(throwOnError):math 节 28 条全部公式段 0 错误
3. 真实 renderMarkdown:markdown +6 / gfm +2 逐条断言;`<script>/<iframe>/onclick` 剥离复证
4. PlantUML 官方服务(~h 端点):6 新增 + 1 既有 = HTTP 200 × 7;mindmap `_` 语义 A/B(rects 3→2)
5. kUML:抓取 github.com/kuml-dev/kUML@main `docs/diagram-types.adoc`(434 行),5 条 snippet 逐字比对
6. 复跑:`pnpm typecheck` exit 0;`pnpm test -- --run` 42/42 文件、380/380 tests
7. 计数:六节 23/8/28/16/13/10 = 98(awk + grep 双核)

(round 1 临时探针文件已删除;round 2 复审探针同样跑完即删,工作区仅余交付变更。)

## 处置账本(round 1)

| # | 发现 | severity | disposition | evidence | decided_by | round |
|---|------|----------|-------------|----------|------------|-------|
| F1 | C1 md-inline-html 描述与管线真实行为不符(标签全被剥) | critical | OPEN → **round 2 FIXED(整条移除)** | syntaxCheatsheet.ts:162-165 + hast-util-sanitize 5.0.2 lib/index.js:283-301 | reviewer | 1 |
| F2 | C2 puml-mindmap「**_=右侧」语义错误(实为无框) | critical | OPEN → **round 2 FIXED(改文案 + left side snippet)** | syntaxCheatsheet.ts:614-616 + PlantUML 服务 A/B 实验 | reviewer | 1 |
| F3 | N1 契约/event-flow 条目数字滞后(15→16,~97→98) | non-critical | OPEN → **round 2 FIXED(22/16/97)** | openapi.yaml add-008 Q/A;event-flow.md | reviewer | 1 |
| F4 | N2 部署图 snippet 为官方样本子集(删 kuml-mcp.jar 行) | non-critical | OPEN(记录) | diagram-types.adoc:196-205 | reviewer | 1 |
| F5 | N3 暂缓清单漏列 object/package(V1.1 型) | non-critical | OPEN → **round 2 FIXED** | diagram-types.adoc:113,152 | reviewer | 1 |
| F6 | N4 白名单通用名残留绕过面 | non-critical | OPEN(记录,可接受) | test.ts:96-117 | reviewer | 1 |
| F7 | N5 STATE.md 未登记 add-008 | non-critical | OPEN(交付阶段处理) | git diff STATE.md | reviewer | 1 |
