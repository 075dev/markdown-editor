# AGENTS.md — MarkDownEditor

> 给未来的 ZCode agent 提供的本工作区简要说明。请在执行重大变更前再次阅读此文件。

## 1. 工作区当前状态

- 路径：`D:\AIWorkSpace\MarkDownEditor`
- 创建时间：2026-08-04
- **状态（2026-08-04 更新）**：已与用户确认方案，正处于脚手架初始化阶段。
  - 产品形态：Markdown 编辑器，本地文件优先
  - 平台优先级：桌面 Windows > 跨平台（暂未构建桌面壳）
  - 编辑范式：源码编辑 + 实时预览（双栏）
  - 桌面壳（计划）：Tauri 2（Rust + 系统 WebView）
  - 前端栈：Vite + Vue 3 + TypeScript + Pinia + Vue Router
  - 编辑器核心：CodeMirror 6（`@codemirror/lang-markdown`、`@codemirror/state`、`@codemirror/view`）
  - Markdown 处理：`unified` + `remark-parse` + `remark-gfm` + `remark-rehype` + `rehype-sanitize` + `rehype-stringify`
  - 代码高亮：`shiki`
  - 数学公式：`KaTeX`
  - 图表：`mermaid`
  - 测试：Vitest（单元/组件）+ Playwright（E2E，后续 Phase 引入）
  - Lint / Format：ESLint + Prettier（Vue 3 模板）
  - 包管理器：**pnpm**（已检测 v11.1.2）

- **当前实际文件**：`AGENTS.md`（已更新）、`package.json` / `vite.config.ts` / `src/` / `src-tauri/` / `.gitignore` 等。
- **Phase 1 验证结果（2026-08-04）**：
  - `pnpm typecheck` ✅ 通过
  - `pnpm test` ✅ 8/8 通过
  - `pnpm build` ✅ 3.17s
  - `cargo check`（Rust） ✅ 通过
  - `pnpm tauri:build` ✅ 1m50s 产出 `markdown-editor.exe` + `MarkDownEditor_0.1.0_x64_en-US.msi` + `MarkDownEditor_0.1.0_x64-setup.exe`
- **环境配置**：`~/.bashrc` / `~/.bash_profile` / Windows 用户级 PATH 均已加入 `C:\Users\075\.cargo\bin`；npm 子进程通过 `scripts/with-rust.mjs` 自动注入 PATH 兜底。

## 2. 在动笔之前的检查清单

后续 agent 第一次进入此工作区时，请按以下顺序探查：

1. 列出根目录内容，确认是否仍是空仓库或已初始化。
2. 查找配置文件：`package.json`、`pyproject.toml`、`Cargo.toml`、`go.mod`、`pom.xml`、`build.gradle`、`*.csproj`、`pubspec.yaml`、`tauri.conf.json`、`electron.*`、`vite.config.*` 等。
3. 如发现 `package.json`，读取 `scripts` 字段以获取构建/测试/检查命令。
4. 检查是否已有 `README.md`、`docs/`、`CONTRIBUTING.md`、`ARCHITECTURE.md`，如有应先阅读再动手。
5. 如发现任何 `.zcode/` 或 `.agents/` 配置目录，说明原 `AGENTS.md` 已被迁移，需先确认版本。

## 3. 推荐的初始化步骤（当仓库仍为空时）

如果未来再次出现空仓库，建议沿以下顺序推进（**不要** 默认替用户选型）：

1. **澄清需求**：使用 `AskUserQuestion` 询问目标平台（桌面 / Web / 插件 / CLI）、所选 Markdown 引擎（如 `marked`、`markdown-it`、`remark`、`pandoc`）、是否需要实时预览、文件树、暗色主题等。
2. **确认架构边界**：编辑区 / 预览区 / 文件 IO / 配置存储 四个最小模块需明确划分，避免后期混杂。
3. **选择构建工具**：桌面端常见 `Electron + Vite`、`Tauri`、`Flutter Desktop`；纯前端可选 `Vite/Next.js`。在未定型前不要安装大型依赖。
4. **先脚手架，后写业务**：创建好最小可运行的 “打开 → 编辑 → 预览” 三栏骨架，并提交首个 commit 之后再做扩展。

## 4. 通用编码约束（一旦有代码后请补全）

将来此节会基于实际仓库内容补充。当前先列出占位原则：

- **路径**：Windows 路径直接使用 `D:\AIWorkSpace\MarkDownEditor\...`；Bash 工具调用改用 `/d/AIWorkSpace/MarkDownEditor/...` 或正斜杠形式。
- **依赖**：添加新依赖前先确认锁文件状态（`package-lock.json` / `pnpm-lock.yaml` / `yarn.lock`），避免混用。
- **日志**：UI 日志优先走项目内统一 logger，禁止使用裸 `console.log` 提交。
- **跨平台**：本机为 Windows，命令行需注意 `bash`（Git Bash）与 `cmd` 的差异。
- **Markdown 渲染**：渲染用户内容必须做 XSS 转义（特别注意 `<script>`、`<iframe>`、`javascript:` 链接）。

## 5. 后续 Agent 必读文档

一旦仓库充实，下列文件如有，**先读后改**：

- `README.md` —— 项目愿景、运行命令。
- `ARCHITECTURE.md` 或 `docs/architecture/*` —— 模块边界。
- `CONTRIBUTING.md` —— 提交流程、风格指南。
- 任何含有 “DO NOT EDIT” 标记的自动生成文件。

## 6. 已知约束与陷阱

- 当前工作区为全新空仓；不要假设已有 `git` 历史或 CI。
- `D:\AIWorkSpace` 下还有 `HermesWorkSpace`、`Hermesplugin`、`QiLing`、`VScodePlugin`、`hermes-studio` 等同级项目，注意不要把它们的依赖或脚本带到这里。
- 项目名包含 “Editor”，意味着 UI 交互是核心——任何破坏键盘可达性、撤销栈、自动保存的改动都需要明确说明。

## 7. 维护说明

- 修改本文件前，请确认你是出于以下原因之一：(a) 仓库初始化；(b) 架构调整；(c) 新增重要约束。
- 不要写入一次性 TODO；使用项目自身的 issue 跟踪。
- 顶部 “当前状态” 一节应随仓库成长而保持准确。
