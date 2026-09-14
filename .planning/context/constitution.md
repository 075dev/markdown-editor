---
constitution_version: 1.0.0
ratified: 2026-09-14
last_amended: 2026-09-14
---

# 项目宪法

> 跨阶段的持久约束层。构建波次划分、实现取舍、评审裁定都以此为准。
> 违反 MUST 原则 = CRITICAL;违反 SHOULD 原则 = 必须书面论证(见豁免表)。

## 核心原则

### C1 服务层封装(MUST)
所有 Tauri API(`invoke`、`@tauri-apps/plugin-*`)调用必须封装在 `src/services/` 下;`components/`、`stores/`、`composables/`、`views/` 禁止直接 import Tauri API。判定:grep 非 services 目录无 `@tauri-apps` 导入即通过。

### C2 环境降级(MUST)
`src/services/` 内每个对外导出的文件/系统能力函数必须有纯 Web 降级路径(`isTauri()` 分支)或在签名注释中显式声明"仅桌面"。判定:每个 service 导出函数要么有 web 分支,要么有显式声明。

### C3 安全底线(MUST)
预览 HTML 必须经过 `rehype-sanitize` 管线渲染,禁止绕过 `src/markdown/pipeline.ts` 直接 `innerHTML`/`v-html` 用户内容;禁止引入 `console.log` 调试残留入库;任何密钥/服务器地址不入 git(走配置)。

### C4 IPC 错误结构(SHOULD)
新增/修改的 Rust command 错误返回逐步规范化为 `Error { code, message }` 结构(见 openapi.yaml),禁止裸字符串新增穿透到 UI 层;存量字符串在触碰时顺手迁移。

### C5 章节留档同步(SHOULD)
每个 ql 阶段交付后,对应 `.qiling/docs/chapters/` 章节与契约(`.planning/context/openapi.yaml`)必须同步更新,禁止契约与实现漂移超过一个阶段。

## 技术栈红线

- 桌面壳:Tauri 2.x(Rust),锁定不漂移
- 前端:Vue 3 + TypeScript + Pinia + Vue Router + Vite
- 编辑器:CodeMirror 6(禁止引入第二编辑器内核)
- 禁止引入:Electron、任何云同步/账号依赖、除 unified/shiki/katex/mermaid 之外的渲染栈(除非宪法修订)

## 豁免表(违规必须登记)

| # | 违反原则 | 为什么需要 | 更简单方案为何被否 | 批准人 |
|---|----------|-----------|-------------------|--------|
| 1 | | | | |

## 修订记录

| 版本 | 日期 | 变更 | 理由 |
|------|------|------|------|
| 1.0.0 | 2026-09-14 | 初版 | /ql-design Phase 1 首次成文,从环境勘察与本次讨论提炼 |
