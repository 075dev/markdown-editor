# markdown-editor · 章节文档

> 本目录是器灵工作流自动生成的**章节化开发文档**。
> 每个章节对应一个完整的 ql 循环(讨论 → 构建 → 交付),同时也是该阶段交付能力的开发者文档。

**快速导航:**
- 章节列表见下表
- API 文档在每个章节的 §一
- 流程留档在每个章节的 §二

---

## 章节列表

| 章节 | 标题 | 阶段 | 状态 | 端点数 | 事件数 | PR | 生成时间 |
|------|------|------|------|--------|--------|-----|----------|
| [chapter-01](./chapters/chapter-01-markdown-editor.md) | markdown-editor(初始化) | init | 📦 initialized | 7 command | 1 | - | 2026-09-14 |
| [chapter-02](./chapters/chapter-02-autosave-conflict-net.md) | 自动保存 + 冲突安全网 | 1 | ✅ shipped | 11 | 1 | [#1](https://github.com/075dev/markdown-editor/pull/1) | 2026-09-15 |
| [chapter-03](./chapters/chapter-03-theme-system.md) | 主题系统与视觉升级 | 1(add) | ✅ shipped | 0(纯前端) | 0 | [#1](https://github.com/075dev/markdown-editor/pull/1) | 2026-09-15 |

---

## API 总览

> 以下为所有已交付章节的 IPC 端点汇总(去重)。详细规范请进入具体章节;完整机器可读契约见 `.planning/context/openapi.yaml`。

### 路径清单

| 方法 | 路径 | 章节 | 说明 |
|------|------|------|------|
| POST | /ipc/open-file-dialog | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#11-端点清单) | 弹窗打开并读取 Markdown |
| POST | /ipc/save-file | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#12-端点详情本阶段核心通道) | 写盘保存(静默写/另存为双语义) |
| POST | /ipc/new-file | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#11-端点清单) | 新建文件(强制另存为) |
| POST | /ipc/read-file | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#12-端点详情本阶段核心通道) | 按路径读取文本 |
| POST | /ipc/watch-file | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#12-端点详情本阶段核心通道) | 监听外部修改(1s 节流) |
| POST | /ipc/unwatch-file | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#11-端点清单) | 取消监听(幂等) |
| POST | /ipc/pick-directory | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#11-端点清单) | 目录选择 |
| POST | /ipc/list-directory | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#11-端点清单) | 列目录(文件树) |
| POST | /ipc/open-diagram-window | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#11-端点清单) | 图表独立窗口 |
| POST | /ipc/list-system-fonts | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#11-端点清单) | 系统字体枚举 |
| POST | /ipc/get-plantuml-server-url | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#11-端点清单) | PlantUML 服务器配置 |
| POST | /ipc/open-external | [chapter-01](./chapters/chapter-01-markdown-editor.md#15-add-002-增量文档链接跳转2026-09-21-并入) | 系统默认程序打开外部链接(协议白名单) |

事件:`file-external-change` `{ path, kind: modified|removed }` —— Rust → 前端,消费语义见 [chapter-02 §1.2](./chapters/chapter-02-autosave-conflict-net.md#12-端点详情本阶段核心通道)。

### 错误码汇总

| HTTP | code | 章节 | 含义 |
|------|------|------|------|
| 404 | FILE_NOT_FOUND | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#14-错误码参考) | 文件不存在 |
| 500 | FILE_READ_FAILED | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#14-错误码参考) | 读取失败 |
| 403 | FILE_WRITE_FAILED | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#14-错误码参考) | 写入失败(可重试) |
| 422 | PATH_INVALID | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#14-错误码参考) | 路径非法 |
| 500 | WATCH_FAILED | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#14-错误码参考) | 监听建立失败 |
| 500 | WINDOW_OPEN_FAILED | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#14-错误码参考) | 窗口创建失败 |
| 422 | UNSUPPORTED_PROTOCOL | [chapter-01](./chapters/chapter-01-markdown-editor.md#15-add-002-增量文档链接跳转2026-09-21-并入) | 协议不在 http/https/mailto 白名单 |
| 500 | OPEN_EXTERNAL_FAILED | [chapter-01](./chapters/chapter-01-markdown-editor.md#15-add-002-增量文档链接跳转2026-09-21-并入) | 系统默认程序调用失败 |
| 500 | INTERNAL_ERROR | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#14-错误码参考) | 未分类内部错误 |

### 数据模型汇总

| Schema | 章节 | 说明 |
|--------|------|------|
| QlError | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#13-数据模型schemas) | 标准错误 {code,message} |
| TabFileStatus | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#13-数据模型schemas) | 标签状态机 clean/dirty/conflict |
| OpenFileResult / SaveFileRequest / SaveFileResult | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#13-数据模型schemas) | 文件读写载荷 |
| DirEntry | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#13-数据模型schemas) | 目录项 |
| OpenDiagramWindowRequest | [chapter-02](./chapters/chapter-02-autosave-conflict-net.md#13-数据模型schemas) | 图表窗口载荷 |

---

## 项目元信息

| 字段 | 值 |
|------|---|
| 项目名 | markdown-editor |
| 版本 | 0.1.0(契约 0.2.0) |
| 当前阶段 | Phase 1 已交付(PR #1,评审 approved);add-001 主题系统、add-002 文档链接跳转已交付 |
| 总章节数 | 3 |
| 总端点数 | 12 |
| 总事件数 | 1 |
| 测试规模 | 311(vitest 全绿) |
| 器灵版本 | 0.5.0 |

**OpenAPI 契约(完整版):** [../../.planning/context/openapi.yaml](../../.planning/context/openapi.yaml)
**事件流程图(完整版):** [../../.planning/context/event-flow.md](../../.planning/context/event-flow.md)
**项目宪法:** [../../.planning/context/constitution.md](../../.planning/context/constitution.md)

---

## 如何阅读本文档

1. **作为新成员:** 先看本索引的"章节列表"和"API 总览",了解项目能力边界
2. **作为能力使用者:** 进入具体章节的 §一,看请求/响应/错误语义
3. **作为维护者:** 进入具体章节的 §二,看流程留档与 Git 摘要
4. **作为升级者:** 看具体章节的 §三"与上一章节对比",了解变更与迁移

---

**生成:** 器灵工作流 v0.5.0,每次 `/ql-deliver` 后增量更新
**维护原则:** 索引文件由器灵自动维护,**不要手改**
