---
add: 005
slug: kuml-support
title: kUML 图表语法支持(https://kuml.dev)
status: reviewed
created_at: 2026-10-09
chapter: chapter-01(并入,自动判断)
contract_version: 0.2.2 → 0.3.0(minor,新增 1 端点 + 2 错误码)
review_verdict: approved(第 1 轮,0 critical / 5 non-critical)
---

# add-005:kUML 图表语法支持

## 需求

用户:「我们可以支持kUml语法吗?」并澄清指 https://kuml.dev/ 的 kUML(Kotlin DSL,
UML 2.x/SysML 2/C4/BPMN 2.0/ERM 等,脚本扩展名 `.kuml.kts`)。可行性结论(2026-10-09
已向用户陈述并获开工确认):可支持,与现有 PlantUML 支持同构接入。

关键事实(核实自 github.com/kuml-dev/kuml README):
- 渲染:`kuml render <file>.kuml.kts --format svg`(ELK 布局),无公开 HTTP 渲染端点
- 安装:`choco install kuml`(自带 Java 21,无需单独 JDK)
- JVM + Kotlin 脚本冷启动约 2-5s → 调用方必须缓存

## 落点判定

**chapter-01(并入),自动判断**,证据:
1. kUML 是预览渲染管线能力(与 add-002 预览链接同域,该增量已入 chapter-01 附录 A.4);
2. 图表家族(mermaid/plantuml)无独立章节,`open-diagram-window` 虽记录在 chapter-02,
   但属构建历史归属而非主题归属,证据弱于主题匹配。

## 契约增量

- `openapi.yaml` 0.2.2 → **0.3.0**(minor,纯新增):
  - 新端点 `POST /ipc/render-kuml`:请求 `{source}`,成功 `{svg}`(500 KUML_RENDER_FAILED /
    503 KUML_NOT_FOUND)
  - Error enum += KUML_NOT_FOUND、KUML_RENDER_FAILED;responses += KumlNotFound、KumlRenderFailed
  - Clarifications 追加 add-005 Q/A;View tag 描述补「图表渲染(kUML)」
- `event-flow.md`:追加「kUML 图表渲染约定(add-005)」节(时序图 + 行为细则 5 条 +
  边缘场景表 8 行)。核心行为:mermaid 模式(管线输出源码块,PreviewPane 客户端
  异步换 SVG)、源码哈希缓存、零依赖 DOMParser SVG 清洗(拒 script/foreignObject/
  on*/javascript:)、CLI 缺失/渲染失败一律保留源码块不阻断编辑、Web 模式跳过。

## 明确不做(裁剪记录)

- 图表独立窗口(open-diagram-window)对 kuml 的复用:SVG→URL 桥接(data:/blob: 跨
  WebviewWindow 上下文失效)引入额外风险,预览内 SVG 已可查看 → 延后;
- 编辑器侧 Kotlin 语法高亮(CodeMirror 语言依赖)→ 延后,编辑器内 kuml 块显示纯文本
  (与 mermaid 现状一致);
- `kuml serve` 常驻服务模式优化冷启动 → 延后(缓存已覆盖主要场景);
- 设置页 kUML 配置项 → 无需求(CLI 路径走 PATH 探测)。

## 实现方式

原计划派发 ql-builder-coordinator,但其子代理上下文无 Agent 派发通道(嵌套派发不可用,
协调器按门控正确拒绝降级)→ 改由主会话充当协调者,直接并行派发 2 个 ql-builder-worker
(零文件重叠,同树隔离纪律,波次 1):

| Worker | 范围 | 交付 |
|--------|------|------|
| W1(Rust) | src-tauri/src/lib.rs(+317):`render_kuml` command(候选名 kuml/.exe/.cmd/.bat,.cmd/.bat 经 cmd /C;CREATE_NO_WINDOW;临时目录 + 60s try_wait 超时 kill;输出文件优先/stdout 兜底;spawn_blocking 包装 async command)+ render_kuml_tests 10 例 | cargo test 17/17 |
| W2(前端垂直切片) | services/kuml.ts(新,canRenderKuml/renderKumlBlocks/sanitizeKumlSvg + FNV-1a 缓存)+ stripDiagramCode SKIP_LANGS += kuml + PreviewPane 步骤 4 接线 + not-installed CSS 提示 + kuml.test.ts 13 例 | typecheck 0;351/351 |

## 已申报偏离(评审确认论证成立)

1. **扫描选择器** `pre > code.language-kuml`(契约原文写反):实证 stripDiagramCode
   输出的 language 类在 `<code>` 上、`<pre>` 无类——原选择器会命中 0 静默失效;
   契约(event-flow.md)已同步修正(时序图 + 细则第 2 条)。
2. **KUML 错误码识别**:不改 errors.ts 的 QlErrorCode 共享 union(先于 add-005 定稿、
   全仓共用),在 kuml.ts 内以 /^KUML_NOT_FOUND:/i 在 normalizeError 保留的原始
   message 上识别(与 W1 Err 格式核对一致)。
3. W1 两点 [ASSUMED](本机无 kuml CLI 无法端到端实测):.cmd/.bat 空格路径引号行为、
   嵌套 `<svg>` 取首开末闭区间——真实渲染成功路径待用户环境联调。
4. lint 未跑(@eslint/js 缺失,既有损坏,基线同样不可跑;本增量禁装依赖)。

## 验证与评审

- **主会话 fresh evidence**:pnpm typecheck exit 0;pnpm test **353/353**(基线 337
  + W2 新增 14 + 评审后加固新增 2);pnpm build PASS(11.52s);cargo test **17/17**
  (10 新增);cargo check PASS(仅存量 warning)
- **ql-reviewer 第 1 轮:`approved`**(0 critical / 5 non-critical;报告留档
  `.qiling/planning/build/add-005-review.md`;评审员复跑 351/351 + 17/17 与 worker
  声明一致):
  - **N1(已修复)**:sanitizer 两绕过变体——scheme 内嵌 tab(`java\tscript:` 过
    startsWith)、命名空间前缀 on*/:href 逃字面名检查 → 加固:属性值剥离
    空白/控制字符后再判 scheme;on*/href 判定看局部名 + 任意 `*:href`;补 2 测试
  - N2(记录):cmd /C 空格路径引号风险(W1 ASSUMED),降级安全,待真实 CLI 联调复验
  - N3(记录):裸名 kuml 命中无扩展名文件时报 RENDER_FAILED 而非 NOT_FOUND(语义边缘)
  - N4(记录):kuml.test.ts mock 错误文案与 W1 真实文案不同(正则仍匹配,保真度小偏差)
  - N5(已修复):lib.rs 缺 EOF 换行已补;svgCache 无上限(会话内存,量级可忽略,接受)
- 评审发现的契约文档不一致(event-flow.md 时序图仍用旧选择器)已同步修正

## 验证中发现的既有缺陷(超本增量范围,另开 bugfix)

**mermaid 客户端渲染疑似长期静默失效**:src/services/mermaid.ts:84 用
`pre.language-mermaid > code`,对真实管线输出(stripDiagramCode 后 language 类在
`<code>` 上、`<pre>` 无类)命中 0 → mermaid 块永远停留在源码态。测试绿因 fixture
手工构造了 `pre.language-mermaid` 形态。修法可参照 kuml.ts 的
`pre > code.language-x`(一行 + 回归用例)。候选编号 bugfix-006。

## 章节同步

- chapter-01:附录 A.5「add-005 增量留档:kUML 图表支持」+ 附录 C.4 变更日志追加
- 索引 docs/README.md:参考汇总(覆盖 9→10 端点 / 契约 13 端点 v0.3.0)+ 路径清单
  + render-kuml 行 + 错误码汇总 += KUML_RENDER_FAILED(500)/ KUML_NOT_FOUND(503)

## 交付物清单

| 类别 | 文件 |
|------|------|
| 契约 | .qiling/planning/context/openapi.yaml(v0.3.0)、event-flow.md(add-005 节) |
| Rust | src-tauri/src/lib.rs(render_kuml + 10 测试) |
| 前端 | src/services/kuml.ts(+13+2 测试)、src/markdown/stripDiagramCode.ts、src/components/PreviewPane.vue |
| 留档 | 本文件、build/add-005-fill-w1.md、build/add-005-fill-w2.md、build/add-005-review.md、docs 章节/索引 |

## 下一步

/ql-deliver(交付:提交 + PR);真实 kuml CLI 端到端联调待用户环境(choco install kuml)。
