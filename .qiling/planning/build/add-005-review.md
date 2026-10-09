# add-005 kUML 图表支持 —— 独立评审报告

- 评审对象:分支 `ql/add-005-kuml`(基于 main 67171c6),未提交工作区变更
- 评审基准:`.qiling/planning/context/openapi.yaml`(v0.3.0,/ipc/render-kuml)+ `event-flow.md` add-005 节
- 评审深度:STANDARD(4 代码文件 + 2 新文件,~350 行;未触及 auth/schema,非 HEAVY 卡)
- 复跑验证(评审者 fresh evidence,2026-10-09):
  - `pnpm typecheck` → **PASS**(exit 0,无输出)
  - `pnpm test -- --run` → **38 files / 351 tests 全过**(其中 kuml.test.ts 13/13、stripDiagramCode.test.ts 5/5,单独复跑确认)
  - `cd src-tauri && cargo test` → **17 passed; 0 failed**(10 个 render_kuml_tests + 7 个存量)
  - 与 W1/W2 报告声明数字完全一致,无 stale/dirty 迹象(验证于当前工作区状态,声明可信)

---

## 结论一:契约合规 —— PASS

| 契约条款 | 证据 | 判定 |
|---|---|---|
| 端点注册 invoke('render_kuml', {source}) → {svg} | lib.rs invoke_handler 注册 + `async fn render_kuml(source: String) -> Result<KumlRenderOk, String>`,`KumlRenderOk { svg }` serde 序列化(lib.rs:888-898 区域) | ✅ |
| 错误码两端口精确一致 | W1 构造 `format!("KUML_NOT_FOUND: {msg}")`(lib.rs kuml_not_found);W2 识别 `/^KUML_NOT_FOUND:[ \t]?/i`(kuml.ts:39),对 normalizeError 保留的完整原始 message 匹配(errors.ts:63-76 前缀未命中时 message 原样保留,已核实) | ✅ |
| W1 message 刻意避开 normalizeError 关键词 | errors.ts:67-75 关键词 not found/denied/invalid/占用/非法;kuml 节全部 message(“is missing from PATH”/“failed to spawn”/“timed out”/“no SVG produced”)逐一核对,均不命中 → 不会误分类,前缀码由 W2 正则承担 | ✅ |
| 超时 60s 计入 RENDER_FAILED | `KUML_TIMEOUT_MS = 60_000`(lib.rs:680 区域),try_wait 轮询 100ms,超时 kill + wait 回收 → `kuml_render_failed("render timed out after 60s ...")` | ✅ |
| 源码哈希缓存 | FNV-1a + 长度前缀(kuml.ts:55-62),模块级 Map 只缓存清洗通过的 SVG(kuml.ts:186),命中不 invoke;test ⑤(同源两块只 invoke 一次,跨调用生效) | ✅ |
| 零依赖清洗:script/foreignObject/on*/javascript: | sanitizeKumlSvg(kuml.ts:76-105):XML 解析 + parsererror 双检 → 遍历根 + `getElementsByTagName('*')` 全部后代(含 svg 子元素)→ tag 名/属性名/属性值三重检查;7 个 sanitize 测试含大小写变体与 xlink:href 变体 | ✅ |
| CLI 缺失/失败保留源码块不阻断编辑 | kuml.ts:190-197 保留 code + 状态标记,只 console.warn;test ②③ 断言源码保留;Rust 侧 `missing_cli_yields_kuml_not_found_error` 真测(本机无 CLI,实际执行断言分支) | ✅ |
| Web 模式跳过 | canRenderKuml false → 全部标 skipped 不 invoke(kuml.ts:133-139),test ④ | ✅ |
| pending 跳过不并发重调 | invoke 前同步置 pending(kuml.ts:170,先于任何 await),test ⑥ 用未决 promise 验证第二次扫描 skip | ✅ |
| 选择器 `pre > code.language-kuml` | 从源码证实(非采信声明):stripDiagramCode.ts:60-77 replacement code 携带 `className: ["language-kuml"]`,pre 无类 → 契约修正成立 | ✅ |
| mermaid 模式管线 + PreviewPane 接线 | SKIP_LANGS + 'kuml'(stripDiagramCode.ts:22);PreviewPane watchEffect 步骤 4 纯追加(diff 仅插入,步骤 1-3 未动一行),try/catch 兜底 | ✅ |
| source minLength: 1 | 事实上被管线强制:stripDiagramCode.ts:54-55 `if (!source) return` 空块不转换、不进 kuml 扫描 → 空 source 永不达 invoke | ✅ |
| Windows CREATE_NO_WINDOW / 临时文件清理 | build_kuml_command `#[cfg(windows)]` 0x0800_0000;闭包包住执行段,任何提前返回走 `remove_dir_all` | ✅ |
| openapi 0.2.2 → 0.3.0 | openapi.yaml:13 `version: 0.3.0`,KUML_NOT_FOUND/KUML_RENDER_FAILED 入 Error enum(yaml:440-441) | ✅ |

**已申报偏离的论证核查(3 项均成立):**
1. 选择器改向 —— 源码级证实,见上表;且旧选择器确实命中 0(与 mermaid 既有静默失效同根,mermaid.ts:84 用 `pre.language-mermaid > code`,已知超范围)。
2. 错误码识别留在 kuml.ts 本地 —— errors.ts QlErrorCode 先于 add-005 定稿,扩共享 union 影响面大于本切片;normalizeError 保留完整 message 使本地正则可行(errors.ts:76 兜底分支已核实);且 W1 message 避开关键词使误分类不可能。论证成立。
3. W1 两点 [ASSUMED] —— 本机无 CLI 无法端到端,失败模式均降级为 KUML_RENDER_FAILED + 源码保留,可接受(详见结论二)。

**契约内部矛盾(文档,非实现问题):** event-flow.md:333 时序图仍写 `扫 pre.language-kuml > code`(旧选择器),与同文件行为细则 :358 的 `pre > code.language-kuml` 矛盾 —— 时序图未随选择器修正同步。

## 结论二:正确性 —— PASS(critical 0)

**Rust 侧:**
- 死锁防护正确:stdout/stderr 由两个独立线程读入(lib.rs read_pipe_to_string 注释所述管道写满互等场景),主线程 try_wait 轮询;超时路径 kill + wait 回收,reader 线程随管道闭合自然退出(JoinHandle drop detach,无 panic 面)。
- panic 面干净:渲染主体无 unwrap;`extract_svg_document` 的字节切片安全(find/rfind 均为 ASCII 标记,边界一致);`tail_chars` 有 count<=max 守卫;nanos 失败 unwrap_or(0)。
- `tauri::async_runtime::spawn_blocking` 用法正确:60s 阻塞不占 async 运行时线程,JoinError 映射为 KUML_RENDER_FAILED。
- `expected_svg_path` 双扩展名剥离(`x.kuml.kts` → `x.svg`)有单测覆盖,与官方行为对齐。

**前端侧:**
- innerHTML 时序安全:注入输入必为 sanitizeKumlSvg 通过后的 XMLSerializer 输出(kuml.ts:110 注释与代码一致);只缓存清洗通过结果,缓存无投毒路径。
- jsdom 兼容:UA 拦截照抄 mermaid 惯例(mermaid.ts:50-52 ↔ kuml.ts:45-50),13 个测试在 jsdom 真实执行(单独复跑确认非空跑)。
- 异常路径不吞源码:fail/not-installed/sanitizer 拒绝三分支均保留 `<code>` 源码,有 DOM 级断言(非只断言 mock 被调用)。

**S1-S8 套路清单扫描:8 条全未命中。** S7 grep 的命中均为合法上下文(lib.rs:665 "placeholder handle" 是存量 plantuml 托盘代码,不在本 diff;“临时”指临时文件领域术语);S6 重点核过:kuml 测试断言 DOM 结果与行为计数,非 mock 调用断言。

**non-critical 发现(5 项):**

| # | 发现 | 证据 | 定级理由 |
|---|---|---|---|
| N1 | sanitizer 绕过变体:(a) scheme 内嵌 tab/换行 `java\tscript:` 能过 `startsWith('javascript:')`(浏览器解析 URL 时剥 tab);(b) xlink 命名空间前缀别名(`xmlns:foo=<xlink-ns>` + `foo:href="javascript:..."`)逃过字面名 `xlink:href` 检查 | kuml.ts:99-100 字面名比较 | 缓解链完整:PreviewPane 点击拦截对 SVG 锚点同样生效且一律 preventDefault(PreviewPane.vue:29,34 `closest('a')` 匹配 SVG a)+ Rust open_external 白名单拒绝 javascript:;威胁模型为本地自渲染内容。记为加固项 |
| N2 | `cmd /C` 调起 .cmd/.bat 在含空格路径下:std 对空格参数加引号,cmd /C 引号数 >2 时剥首尾引号会破坏解析 → 路径含空格的用户(用户名/安装目录)渲染将稳定失败(W1 已申报 [ASSUMED]) | lib.rs build_kuml_command;cmd /? 引号规则 | 失败降级为 KUML_RENDER_FAILED + 源码保留,不崩不阻断;典型安装路径(choco → C:\ProgramData\chocolatey\bin)无空格。已知限制,建议后续真实环境联调时验证 |
| N3 | which_first 裸名 "kuml" 可命中无扩展名文件(如 Git Bash shim 脚本),直接 spawn 失败时报 RENDER_FAILED 而非 NOT_FOUND | lib.rs which_first:594-607 | 外观级边缘:错误码语义偏差,降级行为仍安全 |
| N4 | kuml.test.ts:96 mock message 含 "not found" 字样("kuml CLI not found in PATH"),与 W1 真实 message("is missing from PATH")不同;正则仍匹配所以测试有效,但用例文案与实现契约文本有保真度偏差 | kuml.test.ts:96 ↔ lib.rs kuml_not_found 调用点 | 测试文案与实现文本不一致,不影响行为断言正确性 |
| N5 | svgCache 无上限/无失效(会话内存,量级可忽略;W2 报告已自报);另 lib.rs 新节末尾缺 EOF 换行(rustfmt 会修) | kuml.ts:31;git diff 尾部 `\ No newline at end of file` | 均为已声明/琐碎项 |

## 结论三:代码库一致性 —— PASS

- **服务层镜像 mermaid.ts 惯例**:canRenderX + jsdom UA 拦截(mermaid.ts:50-52 ↔ kuml.ts:45-50)、`console.warn('[mermaid]...'/'[kuml]...')` 前缀格式一致(mermaid.ts:126 ↔ kuml.ts:195)、动态 import('@tauri-apps/api/core') 同 diagramWindow/mermaid 惯例、dataset 状态命名(`data-mermaid-state` ↔ `data-kuml-state`)同构。
- **lib.rs 沿用既有节风格**:错误串 "CODE: message" 前缀(同 read_file/open_external 先例,注释明示)、复用 which_first 无重复造轮子、eprintln! 诊断(存量 15 处同惯例)、候选名常量 + 纯函数拆分 + `#[cfg(test)]` 伴随测试模块,与 plantuml/startup_open/open_external 三节结构一致。
- **测试风格一致**:vi.mock 工厂闭包照 PreviewPane.links.test.ts 惯例(kuml.test.ts:1-12 头注释自述出处,核实无误);resetModules 隔离模块级缓存合理;Rust 测试命名与断言风格同存量模块。
- **CSS 一致**:`--content-text-2` 变量真实存在(global.css:472),muted 提示走既有 token;kuml CSS 正确省略 language 类(与 mermaid 既有 CSS 的坏选择器不同,差异已在 kuml.ts:19-22 注释说明)。

---

## 裁定

- **verdict: approved**
- critical: **0**
- non-critical: **5**(N1-N5,均不阻断;N1/N2 建议随真实 CLI 联调复验)
- 附文档项:event-flow.md:333 时序图选择器与行为细则 :358 矛盾,建议契约侧顺手同步(非代码问题)
- 评审深度说明:STANDARD 档;升档条件均不满足(≤6 文件、非安全架构路径、非 HEAVY 卡);light 理由:变更虽 351 行但结构清晰、测试覆盖完整、无 auth/schema 触碰

复跑原始数字:
```
pnpm typecheck            → exit 0(无输出)
pnpm test -- --run        → Test Files 38 passed (38) / Tests 351 passed (351)
pnpm vitest run src/services/kuml.test.ts → 13 passed (13)
cd src-tauri && cargo test → 17 passed; 0 failed; 0 ignored; 0 measured
```
