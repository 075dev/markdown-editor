# MarkDownEditor

一款本地文件优先的 Markdown 编辑器。目标是：写 Markdown 不再被锁库、不再被同步、不再被云端绑架。

## 技术栈

- **桌面壳**：Tauri 2（Rust + 系统 WebView）
- **前端**：Vite + Vue 3 + TypeScript + Pinia + Vue Router
- **编辑器核心**：CodeMirror 6 + `@codemirror/lang-markdown`
- **Markdown 处理**：`unified` + `remark-parse` + `remark-gfm` + `remark-rehype` + `rehype-sanitize` + `rehype-stringify`
- **代码高亮**：`shiki`（计划 Phase 2 接入）
- **数学公式**：`katex`（计划 Phase 3 接入）
- **图表**：`mermaid`（计划 Phase 3 接入）
- **测试**：Vitest + Playwright（Phase 4 接入 E2E）

## 路线图

- Phase 0：技术骨架 ✅
- Phase 1：核心编辑体验 ✅（打开 / 保存 / 文件树 / 标签页 / CodeMirror / 实时预览）
- Phase 2：写作增强（滚动同步 / 大纲 / 代码高亮 / 自动保存）
- Phase 3：数学公式 / Mermaid / 主题切换
- Phase 4：导出 / E2E
- Phase 5：Git / 插件 / 同步

## 运行

```bash
# 安装依赖
pnpm install

# Web 开发模式（仅前端）
pnpm dev

# 桌面开发模式（需要 Rust 工具链）
pnpm tauri:dev

# 构建桌面安装包
pnpm tauri:build

# 单元测试
pnpm test

# 类型检查
pnpm typecheck
```

## 安全

预览 HTML 经过 `rehype-sanitize` 过滤，禁止 `<script>`、`javascript:` 链接与任意 iframe。 详见 `src/markdown/pipeline.ts`。