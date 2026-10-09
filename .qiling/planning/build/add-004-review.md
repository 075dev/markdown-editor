---
verdict: approved
reviewed_at: 2026-10-02T22:40:00+08:00
round: 1
reviewed_range: 基线 8c050b8(add-003)→ 暂存区(git diff --cached,8 文件,+391/-12;未提交)
waived_by:
waive_reason:
inputs:
  - openapi.yaml (v0.2.2)
  - event-flow.md (add-004 节)
  - constitution.md
  - decisions.md 不存在(契约 Clarifications add-004 Q/A 即设计意图记录)
  - 任务卡内嵌设计决策 1-6(评审基准)
  - 无 add-004 专用 verification/fill-report(工件缺失,见 N5;评审者自行取证)
review_tier: STANDARD(8 文件 391 行,超 LIGHT;未触 auth/**/schema/**/密钥面;纯前端 CSS/store/设置面)
evidence_self_run:
  - npx vitest run src/stores/settings.syntax-theme.test.ts → 8/8 PASS(声明 9 例,实际 8,见 N2)
  - npx vitest run → 335/335 PASS,36 文件(回归零回退)
  - npx vue-tsc --noEmit → exit 0
  - WCAG 对比度矩阵(node 亲算,全变量 × 5 内容底)
  - node_modules/@codemirror/lang-markdown/dist/index.js:63-74 亲探(默认 parser 含 GFM Strikethrough)
---

# 独立评审报告(第 1 轮)—— add-004 markdown 语法染色主题

## 裁定:`criticals_found`

1 个 critical(C1:预览代码块作用域泄漏,一行修复),6 个 non-critical(N1-N6)。follow 默认路径的逐像素恒等经逐变量核对成立;C1 只影响 follow 之外的三个独立方案。三条结论独立成立,详见下。

---

## 结论一:契约合规 —— **FAIL(仅因 C1;其余逐条通过)**

### 1a. openapi.yaml 0.2.1 → 0.2.2

| 契约项 | 结果 | 证据(亲核) |
|--------|------|------|
| patch 语义(纯 Clarifications 追加,无端点/事件变更) | ✅ | diff 仅 +version 行(:11)与 +1 条 Q/A(:31);x-ql-events 未触碰 |
| Clarifications add-004 Q/A 与实现一致 | ✅ | 描述的 data-syntax-theme / --syntax-* / cm-md-* / follow 恒等机制与 diff 完全对应 |
| 「13 变量」计数 | ⚠️ | 契约两处(openapi.yaml:31、event-flow.md 细则2)写 13,实际枚举 h1-h6(6)+ inline-code/bold/italic/strikethrough/link/list(6)= **12**;实现 12 个全定义全消费(grep 亲证 12 个唯一 `--syntax-*`)——契约数字算错,实现与枚举清单一致,记 N1 |

### 1b. 行为契约(event-flow.md add-004 细则 1-6 + 边缘表)

| 验收项 | 结果 | 证据(亲核) |
|--------|------|------|
| 细则1 方案集 follow/rainbow/academic/mono,默认 follow,持久化 v6 | ✅ | settings.ts:54(SYNTAX_THEMES)+ :63-66(resolveSyntaxTheme 非法回落)+ :207-210/:225-228/:240/:265-268(v6 默认与 v5 迁移路径三处均补 syntaxTheme:'follow');测试锁定字面量 |
| 细则2 变量集(12)全定义全消费 | ✅ | 定义 global.css:554-565;消费点编辑器 global.css:398-457(cm-md-heading-1..6/link/code/bold/italic/strike/list)+ 预览 PreviewPane.vue:231-287(h1-h6/a/code/strong/em/del+s/li::marker)——每变量双侧各有 ≥1 消费点,删任一变量必有样式变化 |
| 细则3 follow 默认映射 h1-h3→content-heading,h4-h6→content-text | ✅ | global.css:554-559;恒等链见结论二附表(--content-heading→--text-1 :471,--content-text→--text-1 :470) |
| 细则3 inline-code→content-text;bold/italic/strike→currentColor;link→content-link;list→accent-text | ✅ | global.css:560-565;--content-link follow→--accent(:473)与旧 .cm-md-link var(--accent) 恒等 |
| 细则4 作用域:编辑器 HighlightStyle class + 预览元素;--hl-* 不属本层 | ❌ **C1** | 预览 `.markdown-body code`(PreviewPane.vue:268-270)选择器命中 `pre>code`,且 `pre code` 既有规则(:309-312)只重置背景/padding 无 color——代码块纯文本被 syntax-inline-code 染色,违反「代码块内部不属本层」。详见证伪链见结论二 |
| 细则5 标记符号随色 | ✅ | markdownLanguage.ts:18-32(marks 含于对应高亮 span,CM 解析器事实);无独立标记变量与契约一致 |
| 细则6 编辑器列表色 follow=accent-text 恒等;预览 li::marker 为文档化增强 | ✅ | global.css:455-457(var(--syntax-list),follow=:565 accent-text);预览 ::marker 为新增,契约已明示「增强」——follow 恒等承诺的已声明例外 |
| 边缘表 6 行逐条 | ✅ | follow 恒等/同屏同色(同变量驱动)/sepia+follow(变量引用链 :root 级解析)/sepia+rainbow 正交(data-content-theme 与 data-syntax-theme 独立挂载,测试第 6 例)/非法回落/删除线继承——均成立;表行数 6 与任务卡称 7 不符(N2) |

## 结论二:正确性 —— **FAIL(仅 C1;任务卡疑点 a-e 全部核清;S1-S8 未命中)**

### C1(critical):`.markdown-body code` color 渗入代码块,独立方案下可见错误染色

证伪链(全部亲核):

1. PreviewPane.vue:268-270 新增 `.markdown-body code { color: var(--syntax-inline-code) }`——选择器无 `:not(pre)` 限定。
2. 同文件 :301-307(`.markdown-body pre`)与 :309-312(`.markdown-body pre code`)均无 color 声明 → pre 内 code 的颜色由 :268 决定(0,1,1 特异度,无更高特异度竞争者)。
3. codeHighlight.ts:LANG_MAP 仅 8 语言+别名(:122-133);未知语言整块保持纯文本(:173 `if (!tokenizer) return`);已识别语言 token gap 亦为纯文本(:271、:282)。
4. 后果:```yaml / ```bash / ```text / ```java 等常见语言整块、以及已高亮块的非 token 文本,在 rainbow/academic/mono 下被染成方案 inline-code 色(rainbow #83347c 紫);同时与编辑器侧(经 language-data 正常高亮)观感背离,违背「两边一致」目标。
5. 影响面:follow 默认不受影响(--content-text == --content-text,恒等保持);仅 3/4 方案可见。

修复指引:PreviewPane.vue:268 选择器收窄为 `.markdown-body :not(pre) > code`(或补 `.markdown-body pre code { color: inherit }` 兜底),一行;可补一条渲染集成断言(示例:rainbow 下 pre>code 计算色 ≠ --syntax-inline-code)防复发。修复后仅需复审 PreviewPane 该规则与相关测试。

### 任务卡自我疑点 a-e 核验(全部通过)

| 疑点 | 结论 | 证据 |
|------|------|------|
| a. .cm-md-heading color 移除的权级/顺序 | 无回归 | cm-md 规则全仓仅 global.css 一处(grep 亲证);.cm-md-heading 不再声明 color(:398-400),heading-N 单类选择器后置(:402-424),HighlightStyle 对 heading 无内联色(markdownLanguage.ts:18-23)——无任何竞争声明 |
| b. add-003 h1-h3 margin 规则 | 完整保留 | PreviewPane.vue:236-241(margin-top/bottom 留在组合选择器),仅 color 拆分下放,无样式丢失 |
| c. cm-md-list follow 恒等 | 成立 | global.css:455-457 + :565(follow=accent-text,与旧值逐像素同) |
| d. bold/italic 内联属性与 class color 共存 | 无冲突 | HighlightStyle 内联仅 fontWeight/fontStyle(markdownLanguage.ts:24-25),class 仅 color(global.css:442-448),分属性不冲突;currentColor 在使用点解析=继承=旧无规则状态 |
| e. 三方案对比度 | 白/纸/米黄底全过;两处边缘 | 亲算 WCAG 矩阵:h1(≥3:1)与 inline-code/bold(≥4.5:1)在 #fff/#fdfcf9/#f5eed6 全部通过;night 底为已声明已知限制(N3);academic h5 #5286b4 × parchment #ece1c4 = 2.97:1 压线略低于 AA-large 3:1(N4) |

### follow 逐像素恒等对照表(逐变量)

| 变量 | follow 值 | 编辑器旧值 | 预览旧值 | 恒等 |
|------|-----------|-----------|---------|------|
| h1-h3 | --content-heading→--text-1(:471) | var(--text-1)(被删行) | --content-heading(add-003) | ✅ |
| h4-h6 | --content-text→--text-1(:470) | var(--text-1) | 继承 .markdown-body --content-text(:224) | ✅ |
| inline-code | --content-text(:560) | var(--text-1) | 继承 --content-text | ✅(pre 渗漏除外→C1) |
| bold/italic/strike | currentColor(:561-563) | 无 color 规则 | 无 color 规则 | ✅ |
| link | --content-link→--accent(:473) | var(--accent) | --content-link(add-003) | ✅ |
| list | --accent-text(:565) | var(--accent-text) | (新增 ::marker,文档化增强) | ✅(编辑器) |

### 其他核验

- **GFM 死代码排查**:t.strikethrough 可达——@codemirror/lang-markdown 默认 markdownLanguage 含 GFM 扩展(dist:63-74 亲探,`commonmark.configure([GFM, ...])`),cm-md-strike 非死代码。附带效果:编辑器删除线**新增** line-through 装饰(global.css:450-453),follow 下视觉有变(修齐预览既有行为,颜色恒等不受影响)——记 N6。
- **测试质量**:8 例全部断言真实行为(DOM 属性/localStorage JSON/store 回落/resetAll/三层正交),非 mock 空转;与 settings.content-theme.test.ts 同构。声明 9 例实际 8 例(N2)。
- **回归**:全量 335/335(36 文件)+ vue-tsc exit 0,均亲跑。
- **宪法对照**:C1/C2 不涉(未触碰 Tauri API);C3 达标(diff grep console 零命中,未绕 sanitize——CSS 变量染色在管线之外);C4 无 Rust 变更;C5 openapi 已同步;无新依赖,技术栈红线无触碰。
- **AI 套路清单 S1-S8:已逐条对照,全部未命中**(S1 真实现非字面量;S2 select 已接线 SettingsView.vue:218-234;S3 无新 catch;S4 N/A 纯前端;S5 12 变量均有消费点;S6 断言行为非 mock 调用;S7 唯一 grep 命中为 `applyToDocument` 含 "ToDoc" 的大小写误报;S8 非法值校验在 load 路径真实落地 settings.ts:63-66)。

## 结论三:代码库一致性 —— **PASS**

- settings.ts 六件套(常量/LABELS/type guard/resolve/apply/set/reset)与 add-003 contentTheme 体系逐一同构,STORAGE_KEY v6 复用不升版(纯新增字段透传,与 contentTheme 加入方式一致)。
- CSS 语义层与 --content-* 层同构::root 默认映射 + `:root[data-syntax-theme]` 方案覆盖,置于样式表尾,块注释引用 add-004 与作用域边界。
- SettingsView 新行(row-label/row-hint/row-control + aria-label + data-testid)与 contentTheme 行同构。
- markdownLanguage.ts 单行扩展,与既有条目风格一致。

---

## Non-critical 清单(N1-N6,均不阻断)

| # | 发现 | 证据 | 建议 |
|---|------|------|------|
| N1 | 契约变量计数错误:两处写「13 变量」,实际枚举与实现均为 12 | openapi.yaml:31;event-flow.md add-004 细则2;grep 12 个唯一 --syntax-* | 修契约数字为 12(契约错误按文档修,不动实现) |
| N2 | 声明↔产物偏差:任务卡称「9 例测试」实际 8;称「边缘表 7 行」实际 6 | vitest 输出 8 passed;event-flow.md 边缘表 6 行 | 留档更正即可;测试真实有效非假绿 |
| N3 | 已知限制未入契约:night 内容底 + 固定方案色对比度不足(mono h1 × night 1.02:1 不可见;rainbow 多项 <3:1) | 亲算矩阵;决策叙述已承认但 event-flow 边缘表未列 | 补一行边缘表条目(add-003 parchment+dark 先例亦未入表,不追溯) |
| N4 | academic h5 #5286b4 × parchment 底 2.97:1,压线低于 AA-large 3:0(差 0.03) | 亲算矩阵 | 可微调色值或豁免记录 |
| N5 | 流程工件缺失:.planning/build/ 无 add-003/add-004 verification/fill-report/progress 记录,verification.md 停留 add-001 | 目录清单 | 后续直做变更至少补一行 progress 记录 |
| N6 | follow 下编辑器删除线新增 line-through 装饰(严格说超出「follow 观感恒等」承诺,属修齐预览的改善) | global.css:450-453 + markdownLanguage.ts:26(diff 新增) | 契约细则或边缘表补一句「编辑器删除线装饰随类启用」 |

## 复审范围指引(修复后)

仅需复审:PreviewPane.vue:268-270 的选择器修复及其对 pre 内 code 的影响面;如补回归测试则连同该测试。其余区域(契约文档修订 N1)一并带上即可,无需全量重审。

---

# 第 2 轮复审(2026-10-02)—— C1 修复 + 契约修订

## 裁定:`approved`(第 1 轮 criticals_found → 全部解决)

### C1 复核(受影响面)

- 修复形态:PreviewPane.vue 行内代码规则改为 `.markdown-body :not(pre) > code { color: var(--syntax-inline-code) }`,附作用域注释(亲核 staged diff;与第 1 轮相比源代码仅此一处,stat 50→52 行)。
- 行内代码覆盖面:p/li/td/h1-h6/strong/em/del 下的 code 父级均非 pre → 全部仍被染色。
- 代码块排除面:围栏与缩进代码块(pre>code)不再命中 → 文字继承 `.markdown-body` 的 `--content-text`(PreviewPane.vue:224),follow 恒等保持,三方案下代码块回归内容配色;blockquote 内 pre>code 亦正确排除。
- 特异度/顺序:(0,1,2),与 :309 `pre code`(仅 background/padding)无 color 竞争。
- 与修订后的契约细则4 新措辞逐字对应。

### 契约修订复核

| 项 | 结果 | 证据 |
|----|------|------|
| N1 计数 13→12 | ✅ | event-flow.md mermaid「变量层(12)」+ 细则2「变量集(12)」;openapi.yaml Clarifications「12 变量」;`grep "13 变量\|(13)" .planning/context/` 零残留(亲跑) |
| N3 边缘表 +2 行 | ✅ | 「围栏代码块不受语法染色影响」与「深色内容底(night)+ 固定方案对比度可能下降(已知组合限制)」——与第 1 轮实测矩阵语义一致;表现 8 行 |
| N6 细则7 | ✅ | 「编辑器删除线装饰约定」line-through = GFM 语义对齐,follow 文字色仍继承 |
| N5 验证留档 | ⚠️ | verification.md 追加 add-004 台账(S1-S6,内容与亲历证据一致,含第 1 轮 C1 记录)——**但工作区未暂存**(` M`);`.qiling/docs/chapters/chapter-03-theme-system.md` 的 add-004 章节同步同样未暂存。声明「全部已暂存」与实际不符,提交前需 git add 这两个文档文件 |
| N4 | 维持 non-critical | 接受不修;parchment×academic h5 2.97:1 已留档记录 |

### 复跑实证(代码在第 1 轮取证后已变,按纪律重跑)

- `npx vitest run` → 335/335(36 文件)PASS
- `npx vue-tsc --noEmit` → exit 0
- 章节文档 timeline「全量 335/335」与亲跑一致

### 结论

三结论均转为 **pass**:契约合规(措辞与实现精确对齐)、正确性(C1 修复生效,无新增问题,其余 diff 未变)、代码库一致性(不变)。唯一遗留为暂存卫生(N5 相关:verification.md 与章节文档需随源码一并提交),不构成阻断。
