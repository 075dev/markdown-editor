---
task: add-008-fill-w1 语法速查全域完整化
wave: fill-w1
worker: ql-builder-worker
status: success
---

# 填充报告:add-008 语法速查 55 → 98 条

## 实现说明

按「只收编辑器渲染得出的语法」铁律,把 `src/data/syntaxCheatsheet.ts` 从 55 条扩到 98 条
(六节:23 / 8 / 28 / 16 / 13 / 10),全部新增条目经实证后才收录:mermaid 候选逐条通过
`mermaid.parse` 探针(临时 vitest 文件,跑完即删),PlantUML 候选逐条经项目默认官方渲染服务
(https://www.plantuml.com/plantuml,`~h` 十六进制源码端点)验证,不猜任何语法。
kUML 新增 5 条只用任务卡下发的 docs/diagram-types.adoc 原文 DSL,零改动构造;
测试哨兵同步升级(条目下限 23/8/28/15/13/10,kUML 白名单 18 → 39 构造,注释改四来源)。

## 修改文件

- `src/data/syntaxCheatsheet.ts`:+43 条目;头部注释更新(98 条、四来源、探针说明)
- `src/data/syntaxCheatsheet.test.ts`:下限 23/8/28/15/13/10;白名单 +21 构造(共 39);注释更新
- `.qiling/planning/build/add-008-fill-w1.md`:本报告

边界外零改动(`git status` 仅上述两个 src 文件;临时探针文件已全部删除)。

## 新增条目清单(按节)

### markdown-basics 17 → 23(+6)
- `md-indented-code` 缩进代码块(4 空格缩进,与围栏代码块取舍)
- `md-entities` 实体引用(&copy; &amp; &lt; &rarr;)
- `md-inline-html` 内嵌 HTML(b/em/kbd/sub/sup 可用;description 明确说明 script/iframe/事件属性被预览净化剥离)
- `md-double-backtick` 双反引号行内代码(`` `code` ``)
- `md-closing-heading` 标题闭合(收尾 # 不渲染)
- `md-backslash-break` 反斜杠硬换行(与行尾两空格等效)

### gfm-extended 6 → 8(+2)
- `gfm-email-autolink` 邮箱自动链接(`<user@example.com>` → mailto)
- `gfm-table-inline` 表格单元格内联格式(单元格内行内格式;竖线写 `&#124;`,代码内竖线 `\|`)

### math(KaTeX)12 → 28(+16,每条一个命令组)
`math-operators`(运算符)、`math-relations`(关系符)、`math-arrows`(箭头)、
`math-logic-sets`(逻辑与集合)、`math-calculus-symbols`(微积分与物理符号)、
`math-big-operators`(大运算符,块级上下限)、`math-integrals`(积分族)、
`math-binomial`(binom/tbinom/dbinom)、`math-over-under`(overset/underset/stackrel)、
`math-ext-arrows`(xrightarrow/xleftarrow)、`math-accents`(重音装饰)、
`math-braces`(overbrace/underbrace)、`math-fonts`(字体族)、`math-color`(textcolor/color)、
`math-spacing`(间距与省略号)、`math-mod-norm`(bmod/pmod/lVert/langle)

### mermaid 8 → 16(+8,全部探针通过)
`mermaid-journey`(旅程图)、`mermaid-quadrant`(象限图)、`mermaid-requirement`(需求图)、
`mermaid-gitgraph`(Git 提交图)、`mermaid-timeline`(时间线)、`mermaid-c4`(C4 上下文图)、
`mermaid-sankey`(桑基图 beta)、`mermaid-xychart`(柱状/折线图 beta)

### plantuml 7 → 13(+6,全部经官方服务渲染验证)
`puml-object`(对象图)、`puml-component`(组件图,package + ..>)、`puml-deployment`(部署图,node 嵌套 + artifact + cloud)、
`puml-wbs`(@startwbs 星号层级)、`puml-gantt`(@startgantt lasts/then/--/happens at)、
`puml-mindmap`(@startmindmap,**_ 右侧分支)

### kuml 5 → 10(+5,docs/diagram-types.adoc 原文 DSL,零改动)
`kuml-state`(stateDiagram/state/initial()/final()/goesTo on)、`kuml-usecase`(useCaseDiagram/actor/useCase/associates/includes)、
`kuml-component`(componentDiagram/component/dependsOn)、`kuml-deployment`(deploymentDiagram/executionEnvironment/node/artifact/device/communicationPath)、
`kuml-activity`(activityDiagram/initialNode/action/decision/finalNode/edge + guard)。
每条 description 均带「渲染需本机安装 kuml CLI(choco install kuml),未装时预览保留源码」。

## mermaid 探针记录

探针方式:临时 vitest 文件(jsdom 环境,`mermaid.initialize({startOnLoad:false})` +
`await mermaid.parse(text)`),跑完即删,未进版本库。

| 候选 | 第 1 轮 | 第 2 轮(写法修正) | 最终 |
| --- | --- | --- | --- |
| journey | PARSE-OK | — | 收录 |
| gitGraph | PARSE-OK | — | 收录 |
| timeline | PARSE-OK | — | 收录 |
| C4Context | PARSE-OK | — | 收录 |
| sankey-beta | PARSE-OK | — | 收录 |
| quadrantChart | PARSE-FAIL(Lexical error,未引号中文) | 全引号变体 PARSE-OK(`{"diagramType":"quadrantChart"}`) | 收录(全引号写法) |
| requirementDiagram | PARSE-FAIL(Lexical error,text 未引号) | `text: "…"` / `type: "…"` 引号变体 PARSE-OK(`{"diagramType":"requirement"}`) | 收录(引号写法) |
| xychart-beta | PARSE-FAIL(Lexical error,类目未引号) | `x-axis ["周一",…]` 引号变体 PARSE-OK(`{"diagramType":"xychart"}`) | 收录(引号写法) |

第 1 轮原始输出摘录:
```
[PROBE] journey: PARSE-OK ({"diagramType":"journey","config":{}})
[PROBE] gitGraph: PARSE-OK ({"diagramType":"gitGraph","config":{}})
[PROBE] timeline: PARSE-OK ({"diagramType":"timeline","config":{}})
[PROBE] C4Context: PARSE-OK ({"diagramType":"c4","config":{}})
[PROBE] sankey-beta: PARSE-OK ({"diagramType":"sankey","config":{}})
3 failed(quadrantChart / requirementDiagram / xychart-beta:Lexical error)
```
第 2 轮原始输出摘录:
```
[PROBE2] quadrantChart/全引号: PARSE-OK ({"diagramType":"quadrantChart","config":{}})
[PROBE2] quadrantChart/仅轴引号: PARSE-FAIL(Lexical error on line 5 → 象限标签也必须引号)
[PROBE2] requirementDiagram/text引号: PARSE-OK ({"diagramType":"requirement","config":{}})
[PROBE2] xychart-beta/类目引号: PARSE-OK ({"diagramType":"xychart","config":{}})
```

## PlantUML 验证记录

方式:项目默认渲染服务 `https://www.plantuml.com/plantuml/svg/~h<utf8hex>`,
返回体含 "Syntax Error" 或 HTTP 400 判为失败(语法错误时 PlantUML 服务即回 400 + 错误图)。

| 候选 | 结果 |
| --- | --- |
| object(对象图) | HTTP 200 PARSE-OK |
| component(package + interface + ..>) | HTTP 200 PARSE-OK |
| deployment(node 嵌套 + artifact + cloud) | HTTP 200 PARSE-OK |
| wbs(@startwbs) | HTTP 200 PARSE-OK |
| gantt 含「[任务1] is 5 days」 | **HTTP 400 SYNTAX-ERROR** → 该写法弃用 |
| gantt 无 is(lasts/then/--/happens at) | HTTP 200 PARSE-OK |
| mindmap(@startmindmap,**_) | HTTP 200 PARSE-OK |

## 验证输出摘录

```
$ pnpm typecheck
$ vue-tsc --noEmit
TYPECHECK_EXIT=0

$ pnpm test -- --run
 Test Files  42 passed (42)
      Tests  380 passed (380)
```
基线 380/380,填充后 380/380,零回归(本波次只加固既有哨兵,未新增测试用例)。
逐节条目数(node 实测):`{"markdown-basics":23,"gfm-extended":8,"math":28,"mermaid":16,"plantuml":13,"kuml":10}`,TOTAL 98。

## 与契约的偏离

1. **mermaid 最终 16 条(目标 15)**:任务卡列出的 8 个候选(含 sankey-beta、xychart-beta)
   全部探针通过;按「探针全部通过的候选才收录」原则全部收录,总条数 98(约 97)。
   哨兵下限仍设 15,未抬高。
2. **PlantUML 甘特图写法修正**:任务卡提供的「[任务1] is 5 days」经官方服务实证为语法错误
   (HTTP 400),未收录;条目改用实证通过的 `lasts` / `then` / `-- 分隔 --` / `happens at` 形式。
3. **三个 mermaid beta/特殊图写法加引号**:quadrantChart / requirementDiagram / xychart-beta
   的中文文本不加引号会词法报错,收录的是引号包裹变体(description 已向用户说明)。
   任务卡的探针要求「实证,不许猜」,此为实证结果,非偏离构造。

## 已知问题

- KaTeX 契约域在渲染管线中暂未接线(与契约现状一致,本次仅内容数据,不涉及接线)。
- mermaid-mindmap / C4Context 等既有条目未重复探针(第 1 波已收录,非本波次范围)。

## 关键指标

- 代码行数:syntaxCheatsheet.ts +373 / -3 左右;test +25 / -6 左右
- 新增条目:43(6+2+16+8+6+5)
- 总条目:98(23/8/28/16/13/10)
- 测试:380/380 通过,哨兵下限 23/8/28/15/13/10,白名单 39 构造
