---
chapter_id: "chapter-01"
title: "markdown-editor"
part: "第一篇 · 认识项目"
phase: init
generated_at: "2026-09-28T06:35:34.848Z"
generated_by: "器灵工作流 v0.18.0 / ql-scan"
ql_version: "0.18.0"
last_mapped_commit: "d0a7a5333dad66c8cd877706ba1dd4b906e590ee"
status: "initialized"
docsmap_init: true
scan_path: "."
scanned_entries: 197
routes_detected: 0
events_detected: 0
commands_detected: 0
custom_extracts: 8
endpoints: 0
events: 0
---

# 第 01 章 · markdown-editor(起步)

> 本章是全书的**第一章**:认识并跑起来。由 `/ql-scan` 阅读代码自动生成。
> `<!-- manual -->` 块内的内容欢迎人工撰写润色(重扫自动保留);其余机器节不要手改——项目结构变化后用 `/ql-scan --force` 重扫覆盖。

**一句话:** A local-first Markdown editor built with Tauri 2 + Vue 3 + CodeMirror 6.

## 本章导学

<!-- manual:syllabus -->
- **本章你将学到:** markdown-editor 的 11 个 npm 命令与 8 个 Tauri IPC 命令([§3.5](#三使用说明))怎么用——从把项目跑起来,到按证据核对每一项能力。
- **前置章节:** 无——本章是全书第一章,从零开始。
- **读法:** 只想查用 → 直接进 [§三 使用说明](#三使用说明);完整了解 → 按顺序读;赶时间 → 先读章末"本章小结"再回看正文(教科书惯例)。

(以上为生成器初稿;欢迎人工改写学习目标与前置章节)
<!-- /manual:syllabus -->

## 一、这个功能是什么

<!-- manual:overview -->
**覆盖能力:**

| 能力 | 数量 | 明细位置 |
|------|------|----------|
| npm 命令 | 11 | [§3.1](#三使用说明) |
| Tauri IPC 命令(Rust 侧注册表) | 8 | [§3.5](#三使用说明) |

**项目形态:** Tauri 2 桌面应用(Rust 壳 + 系统 WebView)+ Vue 3 前端(依据 `package.json` description 与 `src-tauri/` 目录、`@tauri-apps/api` 依赖);关键依赖:`vue`、`vite`、`typescript`、`vitest`(用途为推断)。

> 注:8 个 Tauri IPC 命令经 `--patterns` 自定义提取器从 `generate_handler!` 注册表(`src-tauri/src/lib.rs`)提取。内置提取器面向 HTTP 路由 / `registerCommand` / MCP / CLI 风格,本项目均不使用——附录 C 未检出清单中的相应条目是技术栈形态差异,不是能力缺失。

(以上为生成器初稿;欢迎人工补充:这个项目解决什么问题、什么时候用、不适用什么场景)
<!-- /manual:overview -->

## 二、快速上手

<!-- manual:quickstart -->
1. **环境:** Node.js 生态项目(`package.json` 检出)+ Rust 工具链(`pnpm tauri:dev` 经 `scripts/with-rust.mjs` 自动为子进程注入 PATH);包管理器:pnpm
2. **安装:** `pnpm install`
3. **运行:** 桌面应用 `pnpm tauri:dev`(Vite dev server 与 Tauri 壳并行);纯 Web 预览 `pnpm dev`(无文件 IO / IPC 能力)
4. **下一步:** 常用命令清单见 [§3.1](#三使用说明),挑一个命令试跑(如 `pnpm typecheck`)

启动链路(文字版,依据 `package.json` scripts 原样值与 `scripts/with-rust.mjs`):`pnpm tauri:dev` → `with-rust.mjs` 注入 Rust 工具链 PATH → 并行启动 Vite dev server 与 `tauri dev`(Rust 编译 Tauri 壳)→ 壳加载 Vite 页面,前端经 `@tauri-apps/api` invoke 调用 [§3.5](#三使用说明) 的 IPC 命令。

(以上为生成器初稿;欢迎人工补充第一次跑通项目的完整步骤与易踩的坑)
<!-- /manual:quickstart -->

## 三、使用说明

> 本节所有能力条目均从代码反推,每条附 `文件:行号` 证据;与 OpenAPI 契约的对应关系待 `/ql-design` 后补全。

### 3.1 命令清单(package.json scripts,原样列出)

| 命令 | 实际执行 |
|------|----------|
| `npm run dev` | `vite` |
| `npm run build` | `vue-tsc --noEmit && vite build` |
| `npm run preview` | `vite preview` |
| `npm run tauri` | `tauri` |
| `npm run tauri:dev` | `node scripts/with-rust.mjs tauri dev` |
| `npm run tauri:build` | `node scripts/with-rust.mjs tauri build` |
| `npm run typecheck` | `vue-tsc --noEmit` |
| `npm run test` | `vitest run` |
| `npm run test:watch` | `vitest` |
| `npm run lint` | `eslint . --ext .vue,.ts,.tsx --fix` |
| `npm run format` | `prettier --write "src/**/*.{vue,ts,tsx,css,md}"` |

### 3.5 自定义提取(--patterns)

**Tauri IPC 命令(generate_handler 注册表)**

| 标识 | 证据(文件:行) |
|------|------------------|
| `open_diagram_window` | `src-tauri/src/lib.rs:162` |
| `list_system_fonts` | `src-tauri/src/lib.rs:163` |
| `watch_file` | `src-tauri/src/lib.rs:164` |
| `unwatch_file` | `src-tauri/src/lib.rs:165` |
| `read_file` | `src-tauri/src/lib.rs:166` |
| `open_external` | `src-tauri/src/lib.rs:167` |
| `get_plantuml_server_url` | `src-tauri/src/lib.rs:168` |
| `take_startup_open_path` | `src-tauri/src/lib.rs:169` |

### 3.6 项目结构(目录树,深度 ≤ 4,忽略 node_modules/dist/build/.git 等)

```
📄 .editorconfig
📄 .gitignore
📄 .prettierrc.json
📄 AGENTS.md
📄 diagram.html
📄 eslint.config.js
📄 index.html
📄 package.json
📄 pnpm-workspace.yaml
📁 public/  # 静态资源(直接对外)(推断)
  📄 public/favicon.svg
📄 README.md
📁 scripts/  # 构建/工具脚本(推断)
  📄 scripts/build-app-icon.mjs
  📄 scripts/force-refresh-taskbar.ps1
  📄 scripts/verify-icon.ps1
  📄 scripts/verify-plantuml.mjs
  📄 scripts/with-rust.mjs
📁 src/  # 源码主目录(推断)
  📄 src/App.vue
  📁 src/components/  # UI 组件(推断)
    📄 src/components/AutoSaveBanner.test.ts
    📄 src/components/AutoSaveBanner.vue
    📄 src/components/ContextMenu.vue
    📄 src/components/EditorPane.reload-error.test.ts
    📄 src/components/EditorPane.vue
    📄 src/components/FolderTreeNode.vue
    📄 src/components/PreviewPane.links.test.ts
    📄 src/components/PreviewPane.test.ts
    📄 src/components/PreviewPane.vue
    📄 src/components/Sidebar.vue
    📄 src/components/TitleBar.vue
  📁 src/composables/
    📄 src/composables/useAutoSave.test.ts
    📄 src/composables/useAutoSave.ts
    📄 src/composables/useContextMenu.test.ts
    📄 src/composables/useContextMenu.ts
    📄 src/composables/useEditorScrollSync.test.ts
    📄 src/composables/useEditorScrollSync.ts
  📁 src/diagram-view/
    📄 src/diagram-view/diagram.ts
  📁 src/editor/
    📄 src/editor/createEditor.ts
    📄 src/editor/markdownLanguage.ts
    📄 src/editor/panzoomToolbar.test.ts
    📄 src/editor/panzoomToolbar.ts
    📄 src/editor/selectionLineFill.ts
  📄 src/main.ts
  📁 src/markdown/
    📄 src/markdown/codeHighlight.test.ts
    📄 src/markdown/codeHighlight.ts
    📄 src/markdown/headingAnchors.test.ts
    📄 src/markdown/headingAnchors.ts
    📄 src/markdown/linkResolution.test.ts
    📄 src/markdown/linkResolution.ts
    📄 src/markdown/outline.test.ts
    📄 src/markdown/outline.ts
    📄 src/markdown/pipeline.test.ts
    📄 src/markdown/pipeline.ts
    📄 src/markdown/plantumlHighlight.test.ts
    📄 src/markdown/plantumlHighlight.ts
    📄 src/markdown/plantumlRehype.test.ts
    📄 src/markdown/plantumlRehype.ts
    📄 src/markdown/stripDiagramCode.test.ts
    📄 src/markdown/stripDiagramCode.ts
  📁 src/router/
    📄 src/router/index.ts
  📁 src/services/  # 业务服务层(推断)
    📄 src/services/diagramWindow.test.ts
    📄 src/services/diagramWindow.ts
    📄 src/services/editorClipboard.test.ts
    📄 src/services/editorClipboard.ts
    📄 src/services/env.ts
    📄 src/services/errors.test.ts
    📄 src/services/errors.ts
    📄 src/services/externalLinks.test.ts
    📄 src/services/externalLinks.ts
    📄 src/services/fileService.save-errors.test.ts
    📄 src/services/fileService.ts
    📄 src/services/fontService.test.ts
…(共 197 项,已截断显示前 80 项;完整清单请直接浏览目录或收窄 --scan-path)
```

---

## 四、配置与限制

### 4.1 技术栈

**语言分布(按文件扩展名统计):**

| 扩展名 | 文件数 | 占比 |
|--------|--------|------|
| .ts | 67 | 41.1% |
| .png | 49 | 30.1% |
| .json | 10 | 6.1% |
| .vue | 10 | 6.1% |
| .mjs | 3 | 1.8% |
| .rs | 3 | 1.8% |
| .md | 2 | 1.2% |
| .html | 2 | 1.2% |

**框架/关键依赖(推断自 package.json):**

| 依赖 | 用途(推断) | 版本 | 运行时 | 范围 |
|------|--------------|------|--------|------|
| `vue` | 前端框架 | ^3.5.12 | Node.js | prod |
| `vite` | 构建工具 | ^5.4.8 | Node.js | dev |
| `typescript` | 语言/类型 | ~5.6.2 | Node.js | dev |
| `vitest` | 测试框架 | ^2.1.2 | Node.js | dev |
| `eslint` | 代码检查 | ^9.12.0 | Node.js | dev |

**包管理器:** pnpm

**入口(main/bin):** 未声明



### 4.2 依赖清单

| 依赖 | 版本 | 范围 |
|------|------|------|
| `@codemirror/autocomplete` | ^6.18.1 | prod |
| `@codemirror/commands` | ^6.7.1 | prod |
| `@codemirror/lang-markdown` | ^6.3.0 | prod |
| `@codemirror/language` | ^6.10.2 | prod |
| `@codemirror/language-data` | ^6.5.1 | prod |
| `@codemirror/search` | ^6.5.6 | prod |
| `@codemirror/state` | ^6.4.1 | prod |
| `@codemirror/view` | ^6.34.1 | prod |
| `@lezer/highlight` | ^1.2.1 | prod |
| `@tauri-apps/api` | ^2.11.1 | prod |
| `@tauri-apps/plugin-dialog` | ^2.7.2 | prod |
| `@tauri-apps/plugin-fs` | ^2.5.1 | prod |
| `katex` | ^0.16.11 | prod |
| `mermaid` | ^11.4.0 | prod |
| `panzoom` | ^9.4.4 | prod |
| `pinia` | ^2.2.4 | prod |
| `plantuml-encoder` | ^1.4.0 | prod |
| `rehype-sanitize` | ^6.0.0 | prod |
| `rehype-stringify` | ^10.0.1 | prod |
| `remark-gfm` | ^4.0.0 | prod |
| `remark-parse` | ^11.0.0 | prod |
| `remark-rehype` | ^11.1.1 | prod |
| `unified` | ^11.0.5 | prod |
| `unist-util-visit` | ^5.1.0 | prod |
| `vue` | ^3.5.12 | prod |
| `vue-router` | ^4.4.5 | prod |
| `@tauri-apps/cli` | ^2.11.4 | dev |
| `@types/hast` | ^3.0.5 | dev |
| `@types/katex` | ^0.16.7 | dev |
| `@types/node` | ^22.7.4 | dev |
| `@vitejs/plugin-vue` | ^5.1.4 | dev |
| `@vue/test-utils` | ^2.4.6 | dev |
| `eslint` | ^9.12.0 | dev |
| `eslint-plugin-vue` | ^9.28.0 | dev |
| `jsdom` | ^25.0.1 | dev |
| `prettier` | ^3.3.3 | dev |
| `sharp` | ^0.35.3 | dev |
| `typescript` | ~5.6.2 | dev |
| `vite` | ^5.4.8 | dev |
| `vitest` | ^2.1.2 | dev |
| `vue-tsc` | ^2.1.6 | dev |

---

## 五、故障排查

**把项目跑起来**

- 启动链路未能自动检出(原因见附录 C):先确认依赖已安装,再按 `package.json` 的 `scripts` 与项目 README 人工确认启动方式。

**能力清单看起来太少?**

- 本扫描器识别 npm scripts、HTTP 路由(`app.get()` 类惯例)、事件发布(`emitter.emit()` / `this._onX.fire()` 惯例)、命令/工具注册(`registerCommand` / MCP tool / CLI command)。项目若用其他注册风格,用 `--patterns` 自定义提取器补充后重扫。

**怀疑文档过期?**

- 用附录 C 的基线 commit 自查:`git log --oneline <基线>..HEAD`;项目结构大改后用 `/ql-scan --force` 重扫。

---

## 本章小结

<!-- manual:summary -->
- 本章认识了 markdown-editor:11 个 npm 命令、8 个 Tauri IPC 命令([§3.5](#三使用说明))。
- 桌面端启动:`pnpm tauri:dev`(链路见 [§二](#二快速上手));纯前端预览:`pnpm dev`。
- 完整能力清单与证据在 [§三](#三使用说明);配置与限制在 [§四](#四配置与限制)。

(以上为生成器初稿;欢迎人工改写要点回顾)
<!-- /manual:summary -->

## 下一章

<!-- manual:next -->
- 本书现有 3 章:本章(认识项目)之后是第二篇功能详解——[第 02 章 · 自动保存 + 冲突安全网](./chapter-02-autosave-conflict-net.md)、[第 03 章 · 主题系统与视觉升级](./chapter-03-theme-system.md);后续交付按篇追加。
- 想先动手?回到 [§二 快速上手](#二快速上手) 把命令跑一遍。

(以上为生成器初稿;欢迎人工按学习路径指定下一章——不必等于交付顺序)
<!-- /manual:next -->

---

## 附录 A · 交付与开发留档

(本附录面向维护者与 AI 审计,使用者可跳过)

### A.1 扫描信息

| 字段 | 值 |
|------|---|
| 来源命令 | /ql-scan |
| 扫描路径 | . |
| 扫描基线 commit | d0a7a5333dad66c8cd877706ba1dd4b906e590ee |
| 扫描条目数 | 197(目录树显示 80) |
| 生成时间 | 2026-09-28T06:35:34.848Z |

### A.2 新代码放哪(推断指引)

| 要新增的内容 | 建议位置(推断) |
|--------------|------------------|
| API 端点 | 遵循项目现有分层;若无路由目录,建议新建 routes/ 并在入口注册 |
| 业务逻辑 | 与现有模块就近放置,保持单一入口 |
| 测试 | 跟随现有测试目录,与被测文件同名 |

### A.3 下一步

- 尚无 OpenAPI 契约 → 运行 `/ql-design` 生成契约(§3.2 路由清单可作为讨论输入)
- 已有 OpenAPI 契约 → 运行 `/ql-build` 直接构建

### A.4 add-002 增量留档:文档链接跳转(2026-09-21 并入)

<!-- manual:increment -->
> 本节为 add-002 交付时点的留档原文(由旧版章节 §1.5 迁入,史实保留;"第 7 个 Rust command"为当时口径,现注册表共 8 个,见 §3.5)。另注:上方 A.3 的"尚无 OpenAPI 契约"是脚本静态指引文本——实际契约已存在(`.planning/context/openapi.yaml` v0.2.0,12 个 /ipc 端点),增量交付应走 `/ql-add`。

> 落点判定:自动判断并入本章——预览渲染管线与链接点击属本章前端核心域,复用 FileIO 域既有 `/ipc/read-file` 端点与 `openFileFromPath` 能力;与 chapter-02(自动保存)/chapter-03(主题)零契约重合(唯一匹配)。

**新端点(第 7 个 Rust command):**

| 端点 | 说明 | 错误码 |
|------|------|--------|
| POST `/ipc/open-external` | 用系统默认程序打开外部链接;协议白名单 http/https/mailto(Rust 侧二次校验,白名单外拒绝传递给系统 shell) | 422 UNSUPPORTED_PROTOCOL、500 OPEN_EXTERNAL_FAILED |

**行为增量(无新事件,契约 v0.1.1 → 0.2.0):**

- 预览区 `<a>` 点击事件委托,**所有分支一律 preventDefault**(修复现状缺口:WebView 内点击链接会导航冲掉编辑器);
- 三分支路由:`#锚点` → 预览内平滑滚动;http/https/mailto → `/ipc/open-external`;相对/工作区路径文档链接 → 解析绝对路径后经 `/ipc/read-file` 在编辑器内打开目标文档(文档间连接);
- 渲染管线新增自写 rehype 插件 `headingAnchors`(GitHub 风格 slug,CJK 保留,重名 -N 去重),sanitize `clobberPrefix: ''` 让标题 id 保留;
- 新前端模块:`src/services/externalLinks.ts`(C2 有 web 降级)、`src/markdown/linkResolution.ts`(分类 + 相对路径解析纯函数);
- 时序与细则见 `.planning/context/event-flow.md`「文档链接跳转约定(add-002)」。
<!-- /manual:increment -->

### A.5 add-005 增量留档:kUML 图表支持(2026-10-09 并入)

<!-- manual:increment -->
> 落点判定:自动判断并入本章——kUML 是预览渲染管线能力(与 add-002 预览链接同域);
> 图表家族无独立章节,`open-diagram-window` 在 chapter-02 属构建历史归属而非主题归属。

**新端点(第 9 个 Rust command,契约 v0.2.2 → 0.3.0):**

| 端点 | 说明 | 错误码 |
|------|------|--------|
| POST `/ipc/render-kuml` | 渲染 kUML DSL 源码(https://kuml.dev,Kotlin 脚本)为 SVG;Rust 探测 PATH 中 kuml CLI(choco install kuml 自带 Java 21),临时 `.kuml.kts` + `kuml render --format svg`,输出文件优先、stdout 兜底,超时 60s | 500 KUML_RENDER_FAILED(脚本错误/超时)、503 KUML_NOT_FOUND(CLI 未装) |

**行为增量(mermaid 模式,无新事件):**

- `stripDiagramCode` SKIP_LANGS += `kuml`;渲染管线只输出源码块(无 URL 可挂 img,与 PlantUML 不同);
- 新前端模块 `src/services/kuml.ts`:扫 `pre > code.language-kuml`(实证:language 类在 `<code>` 上)、按源码 FNV-1a 哈希缓存(冷启动 2-5s)、`data-kuml-state` ∈ pending/ok/fail/not-installed/skipped;
- **SVG 清洗**(零依赖 DOMParser):拒 script/foreignObject/任意前缀 on* 属性/任意 `*:href` 的 javascript: 引用(含 scheme 内嵌 tab/换行变体)——该注入路径绕过 rehype-sanitize,清洗必须在 innerHTML 前;
- 降级:CLI 未装 → 源码块 + CSS 提示;渲染失败 → 源码块保留;Web 模式 → skipped;均不阻断编辑;
- `PreviewPane.vue` watchEffect 步骤 4 接线(不动步骤 1-3);
- 时序与细则见 `.qiling/planning/context/event-flow.md`「kUML 图表渲染约定(add-005)」。

**明确不做(延后):** 图表独立窗口(SVG→URL 桥接风险)、编辑器侧 Kotlin 高亮、`kuml serve` 常驻模式、设置页配置项。
<!-- /manual:increment -->

### A.6 add-006 增量留档:应用内语法速查面板(2026-10-09 并入)

<!-- manual:increment -->
> 落点判定:自动判断并入本章——编辑器核心 UX 能力(与 add-002/add-005 同章先例);
> chapter-02=自动保存、chapter-03=主题系统,无主题重合。纯前端,无新端点/事件(契约 0.3.0 → 0.3.1)。

**能力:**

- 应用内模态速查浮层:六域条目(Markdown 基础 / GFM 扩展 / 数学 KaTeX / mermaid / PlantUML / kUML,共 28 条),「名称 + 语法示例 + 一句话说明」,内容打包内置离线可用;
- 入口三路:**F1**(HomeView 全局按键)/ 标题栏「?速查」按钮 / 编辑器右键菜单「语法速查 (F1)」;
- 关键词过滤(title/description/snippet 大小写不敏感包含)+ 空态提示;
- 条目级一键复制(复用 `writeClipboard`),成功/失败按钮反馈;v1 只读速查,不自动插入编辑器(不碰撤销栈);
- 可达性:role=dialog、打开聚焦搜索框、Tab 焦点陷阱、Esc 关闭焦点归还;浮层仅拦截 F1/Esc/Tab,其余全局快捷键行为不变;遮罩点击关闭(与 ContextMenu 惯例一致);
- kUML 条目只用官方 README 验证过的 Kotlin DSL 构造(数据测试含防臆造哨兵);渲染需本机 kuml CLI。

**新模块:** `src/data/syntaxCheatsheet.ts`(内容)、`src/composables/useSyntaxCheatsheet.ts`(模块级开关+焦点归还)、`src/components/SyntaxCheatsheetModal.vue`;接线 HomeView/TitleBar/main.ts。
细则见 `.qiling/planning/context/event-flow.md`「语法速查面板约定(add-006)」。
<!-- /manual:increment -->

### A.7 add-007 增量留档:速查内容扩充 28 → 55 条(2026-10-09 并入)

<!-- manual:increment -->
> 落点判定:add-006 同域续作(chapter-01),纯内容扩充,UI/交互零变化。契约 0.3.1 → 0.3.2(patch)。

**内容铁律:**

1. 只收编辑器渲染得出的语法(remark-gfm / KaTeX / mermaid 11 / PlantUML 标准集);渲染不出的不收(如 `==高亮==`);
2. kUML 仅限官方验证构造,三来源:GitHub README Quick Start、kuml.dev/llm、官方 examples `kuml-getting-started.kuml.kts`;数据测试以「调用白名单」哨兵固化(18 构造,扫描前剥离字符串字面量)。

**扩充清单(28 → 55):**

| 节 | 条目 | 新增 |
|----|------|------|
| Markdown 基础 | 17 | 粗斜体、多级引用、嵌套列表、引用式链接、转义字符 |
| GFM 扩展 | 6 | 裸网址自动链接 |
| 数学(KaTeX) | 12 | 上下标、分数、根号、求和/积分/极限、希腊字母、矩阵、自适应定界符、多行对齐、方程组、公式内文字 |
| mermaid | 8 | 状态图、ER 图、饼图、甘特图、思维导图 |
| PlantUML | 7 | 活动图、状态图、注释、生命线激活 |
| kUML | 5 | 关联修饰(多重性/聚合)、时序图、C4 系统上下文(需 import) |

**已知限制(DEFERRED):** KaTeX 渲染管线尚未接线(README 路线图 Phase 3 的数学公式支持),数学节条目当前展示语法但预览不渲染公式(继承自 add-006 的域声明,待数学公式 add 立项)。
<!-- /manual:increment -->

### A.8 add-008 增量留档:速查全域完整化 55 → 97 条(2026-10-09 并入)

<!-- manual:increment -->
> 落点判定:add-006/007 同域续作(chapter-01),纯内容扩充,UI/交互零变化。契约 0.3.2 → 0.3.3(patch)。

**收录标准(完整化边界)**:编辑器渲染得出的全部语法域的**常用全集**,非 API 全表——
KaTeX 800+ 命令取 16 类高频组;mermaid 新渲染器以 node 探针实证 parse 通过为准;
PlantUML 小众扩展不收;Markdown 内嵌 HTML 不收(评审实证:预览管线对 raw HTML
整体丢弃,hast-util-sanitize 无 raw 分支,如需支持须另行立项);kUML 收常用 10 图型
(timing/communication 等小众型暂缓,补录走同一官方来源流程)。

**最终条目(98 条目的前身 55 → 97)**:

| 节 | 条目 | 本轮新增 |
|----|------|----------|
| Markdown 基础 | 22 | 缩进代码块、实体引用、双反引号行内代码、标题闭合、反斜杠换行(内嵌 HTML 经实证移除) |
| GFM 扩展 | 8 | 邮箱自动链接、表格单元格内行内格式(&#124; 转义) |
| 数学(KaTeX) | 28 | 运算符/关系符/箭头/逻辑集合/微积分符号/大运算符/积分族/二项式/上下放置/箭头标注/重音装饰/花括号结构/字体族/颜色/间距省略号/模与范数 16 组 |
| mermaid | 16 | 旅程图、象限图、需求图、gitGraph、时间线、C4 上下文、桑基图、xyChart(8 候选全部 node 探针 PARSE-OK;中文需引号包裹变体) |
| PlantUML | 13 | 对象图、组件图、部署图、WBS、甘特图、思维导图(甘特 lasts/then 写法经官方服务实证;简报原建议写法实证 400 弃用) |
| kUML | 10 | 状态图、用例图、组件图、部署图、活动图(docs/diagram-types.adoc 第四官方来源逐字核验);白名单哨兵扩至 39 构造 |

**DEFERRED:** ① KaTeX 渲染管线接线(数学节展示语法但预览不渲染,Phase 3);② Markdown 内嵌 HTML 支持(sanitize raw 分支,如需另立项);③ kUML 小众图型补录。
<!-- /manual:increment -->

---

## 附录 B · 与上一章节对比

无(本章节为初始化章节,是文档树的第一个节点;后续交付章节的对比见各章节附录 B)。

---

## 附录 C · 数据来源与验证

### C.1 关联文档

- [文档树索引](../README.md)
- 项目状态:[../.planning/STATE.md](../../.planning/STATE.md)
- OpenAPI 契约:[.planning/context/openapi.yaml](../../.planning/context/openapi.yaml)

### C.2 未检出清单

| 项 | 状态 | 原因 | 建议 |
|----|------|------|------|
| HTTP 路由 | 未检出(Not detected) | 未在路由语境文件(`*routes*`/`*router*`/`*controller*` 或 `app.xxx()` 调用)中发现端点声明 | 若使用装饰器/配置式等其他路由风格,用 `--patterns` 自定义提取器补充,或运行 `/ql-design` 生成契约 |
| 事件发布 | 未检出(Not detected) | 未发现 `emitter.emit()` / `bus.publish()` / `this._onX.fire()` 类调用 | 若使用其他事件惯例,用 `--patterns` 自定义提取器补充 |
| 命令/工具注册 | 未检出(Not detected) | 未发现 `registerCommand` / MCP `server.tool` / CLI `program.command` 类调用 | 若项目有其他注册风格,用 `--patterns` 自定义提取器补充 |
| 启动链路 | 未检出(Not detected) | package.json 无 main/bin 字段 | 以项目 README 或 `package.json` 的 scripts 为准人工确认 |

### C.3 证据与推断约定

- §三 各表中的 `文件:行号` 是**证据锚点**——每条能力均从代码反推,可对照源码核实。
- 带"(推断)"的内容(目录职责、依赖用途、新代码位置)来自命名约定词典,**是推断而非事实**,以实际代码为准。
- 新鲜度:frontmatter `last_mapped_commit` 即生成时的 git HEAD;运行 `git log --oneline <基线>..HEAD` 判断文档是否过期。

### C.4 变更日志

| 日期 | 操作 | 说明 |
|------|------|------|
| 2026-09-28T06:35:34.848Z | 自动生成 | 由 `/ql-scan` 初始化,基线 commit `d0a7a533` |
| 2026-09-28 | fix(bugfix-003) | 文档链接跳转命中已打开的未保存文件 → 进冲突安全网而非静默覆盖(6db9b3f;评审 approved) |
| 2026-10-09 | add(add-005) | kUML 图表语法支持:新端点 /ipc/render-kuml + 客户端渲染/缓存/SVG 清洗(契约 0.2.2→0.3.0;评审 approved,0 critical) |
| 2026-10-09 | add(add-006) | 应用内语法速查面板:F1/标题栏/右键菜单三入口,六域 28 条 + 搜索 + 一键复制(纯前端,契约 0.3.1;评审 approved,0 critical) |
| 2026-10-09 | add(add-007) | 速查内容扩充 28 → 55 条(kUML 仅官方验证构造,白名单哨兵;契约 0.3.2;评审 2 轮 approved,首轮 1 critical 已修) |
| 2026-10-09 | add(add-008) | 速查全域完整化 55 → 97 条(常用全集,mermaid 探针门 + kUML 白名单 39 构造;契约 0.3.3;评审 2 轮 approved,首轮 2 critical 已修:内嵌 HTML 条目实证移除、PlantUML 思维导图文案纠正) |
