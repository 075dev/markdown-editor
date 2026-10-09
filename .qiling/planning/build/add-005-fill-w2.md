---
task: add-005-fill-w2 (kUML 前端垂直切片)
wave: 2
worker: ql-builder-worker
status: success
---

# W2 报告:kUML 前端垂直切片(stripDiagramCode + 渲染服务 + PreviewPane 接线)

## 实现说明

```kuml 围栏代码块的前端渲染链路:stripDiagramCode 把 kuml 纳入跳过语言(绕过高亮、保留源码);
新建 src/services/kuml.ts 扫描预览 DOM 中的 kUML 源码块,经 Rust 命令 `render_kuml` 出 SVG,
模块级源码哈希缓存命中则免 invoke(冷启动 2-5s);注入前经零依赖 sanitizeKumlSvg 清洗
(该路径绕过 rehype-sanitize);失败 / CLI 未安装保留源码块并打 data-kuml-state;
PreviewPane watchEffect 追加「4) kUML 客户端渲染」try/catch 接线,另附 not-installed
状态的 CSS muted 提示行。

## 变更文件

- src/markdown/stripDiagramCode.ts:SKIP_LANGS 增加 'kuml'(头注释同步)
- src/markdown/stripDiagramCode.test.ts:skip 断言补 kuml;新增 kuml 走完 pipeline 的保留源码用例
- src/services/kuml.ts(新建):canRenderKuml / renderKumlBlocks / sanitizeKumlSvg
- src/services/kuml.test.ts(新建):13 个用例(渲染/错误/缓存/并发/sanitize 全覆盖)
- src/components/PreviewPane.vue:import + watchEffect 步骤 4(不动步骤 1-3 任何一行)+ CSS 提示

## 实现要点

### 缓存键
- FNV-1a 32 位哈希(零依赖,Math.imul)+ 源码长度前缀(`len36-hash36`)降低碰撞面
- Map<string, string>:哈希 → **清洗后**的 SVG;只缓存清洗通过的结果
- 命中路径直接注入,不 import Tauri API、不 invoke;跨 renderKumlBlocks 调用持久(模块级)

### 状态机(pre.dataset.kumlState)
- `skipped`:非 Tauri / jsdom(canRenderKuml false)→ 全部标记 + skip 计数
- `pending`:invoke 前同步设置 → 并发二次扫描跳过(防重复 invoke);ok/pending 跳过,其余重试
- `ok`:成功;pre 清空注入 svg,`<code>` 移除
- `not-installed`:Err 前缀 `KUML_NOT_FOUND:`(仅此码;正则 `^KUML_NOT_FOUND:` 对
  normalizeError 保留的完整原始 message 匹配);保留源码
- `fail`:KUML_RENDER_FAILED / 其他错误 / sanitizeKumlSvg 拒绝;保留源码
- not-installed 与 fail 均计入 fail 计数(状态区分由 dataset 承载);只 console.warn 不上抛

### 清洗规则(sanitizeKumlSvg,零依赖)
DOMParser 按 'image/svg+xml' 解析(异常与 parsererror 双检)→ 根须为 svg → 遍历全部节点:
tag 为 script/foreignObject、属性名 on* 开头、href/xlink:href 值 javascript: 开头
(均大小写不敏感)→ null;通过则 XMLSerializer 序列化 documentElement。
jsdom 25 下 DOMParser/XMLSerializer 可用,parsererror 路径实测生效。

### 错误分类与 W1 对齐
[VERIFIED: .qiling/planning/build/add-005-fill-w1.md:22,28] W1 契约:Err "CODE: message",
code ∈ KUML_NOT_FOUND / KUML_RENDER_FAILED;W1 刻意避开 "not found/denied/invalid" 关键词防
normalizeError 误分类。本侧只消费 message 前缀(normalizeError 作统一入口,其 QlErrorCode
先于 add-005 定稿不含 KUML_*,故 KUML 码在 message 上识别 —— 见「偏离」第 2 条)。

## 与契约的偏离(显式标注,未静默改契约)

1. **扫描选择器** `pre > code.language-kuml`(契约原文 `pre.language-kuml > code`)。
   依据:pipeline 实际输出为 `<pre><code class="language-kuml">`(language 类在 code 上,
   stripDiagramCode/codeHighlight 均不复制到 pre;经临时 vitest 脚本实证后删除)。
   契约原选择器对真实输出命中为 0 → 功能静默失效。新选择器对两种形态均兼容。
   **连带发现(既有问题,未修、超出本任务边界)**:mermaid.ts 的
   `pre.language-mermaid > code` 同样命中 0,mermaid 客户端渲染疑似长期静默失效
   [VERIFIED: src/services/mermaid.ts:84 + pipeline 实证],建议另开 bugfix。
2. **KUML 错误码识别位置**:normalizeError 仍是统一入口,但其 CODE_PREFIX_RE/QlErrorCode
   先于 add-005 定稿、不含 KUML_*;故在 normalizeError 保留的原始 message 上以本地正则
   `^KUML_NOT_FOUND:` 判定(未改 errors.ts —— 它被全仓共用,扩 union 影响面超出本切片)。
3. **lint 未跑**:package.json 的 `lint` 为全仓 `--fix` 模式,会写边界外文件(禁止);
   只读 eslint 直跑亦失败 —— `eslint.config.js` 顶层 import 的 `@eslint/js` 既不在
   package.json 声明也不在 node_modules(ERR_MODULE_NOT_FOUND,既有损坏,与本次改动无关,
   基线同样不可跑);任务禁止安装依赖。已对改动文件跑 typecheck/test 替代验证。

## 验证输出摘录

```
$ pnpm typecheck
$ vue-tsc --noEmit        → exit 0,无输出

$ pnpm test -- --run
 Test Files  38 passed (38)
      Tests  351 passed (351)     ← 基线 337 + 新增 14,零回归
 Duration  5.73s

$ pnpm vitest run src/services/kuml.test.ts src/markdown/stripDiagramCode.test.ts
 ✓ src/services/kuml.test.ts (13 tests)
 ✓ src/markdown/stripDiagramCode.test.ts (5 tests)
 Tests  18 passed (18)
```

## 提交

无(任务卡明令禁止 git commit;全部变更留在工作区,由协调器统一收口)。
工作区状态:`M` PreviewPane.vue / stripDiagramCode.ts / stripDiagramCode.test.ts;
`??` kuml.ts / kuml.test.ts。

## 已知问题 / 风险

- mermaid 选择器静默失效(见偏离 1)——本切片未触碰 mermaid 行为,零回归(351 全绿佐证)。
- 端到端(Tauri 壳内真实 invoke)未验证:jsdom 无 Tauri;W1 侧同样因本机无 kuml CLI 仅
  错误路径真测。首装 CLI 后的首次真实渲染属联调项。
- 缓存无失效/上限:源码改了键就变(旧键遗留),编辑器会话内内存量级可忽略;
  重开应用即清空。
- pending 防重入只保证「同步置 pending 先于任何 await」,单块级别无重复 invoke;
  多块并发扫描下后续块理论上可被两次调用交错处理(ok 状态兜底,最坏多渲染不丢数据)。

## 关键指标

- 代码行数:+328(kuml.ts 176 + kuml.test.ts 229 - 复用惯例;净增含测试)
- 测试用例:14 新增(13 kuml + 1 stripDiagramCode pipeline),全量 351/351
