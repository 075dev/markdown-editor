# markdown-editor · 项目书

> **A local-first Markdown editor built with Tauri 2 + Vue 3 + CodeMirror 6.**
>
> 本页是全书的**前言与目录**。全书按"先跑起来,再逐功能深入"的顺序组织:每章有导学(学什么)、正文(怎么用)、小结(回顾什么)。

## 前言

- **这本书讲什么:** A local-first Markdown editor built with Tauri 2 + Vue 3 + CodeMirror 6.
- **适合谁:** 新接手的开发者(按目录顺序读)/ 只想查用的调用方(直接进章节 §三 使用说明)/ 维护者(看各章附录 A)。
- **怎么读:** 按下方目录顺序学习;每章开头"本章导学"标了前置章节与读法,章末"本章小结"可先读再回看正文。
- **快速上手:** 1. 安装 `pnpm install` 2. 运行 启动方式见第一章 §二 3. 详细步骤见 [第一章 §二](./chapters/chapter-01-markdown-editor.md#二快速上手)

## 目录

**第一篇 · 认识项目**

- [第 01 章 · markdown-editor(起步)](./chapters/chapter-01-markdown-editor.md)

**第二篇 · 功能详解**

- [第 02 章 · 自动保存 + 冲突安全网](./chapters/chapter-02-autosave-conflict-net.md)
- [第 03 章 · 主题系统与视觉升级](./chapters/chapter-03-theme-system.md)

---

## 参考汇总(全书附表)

| 维度 | 数量 | 明细位置 |
|------|------|----------|
| API 端点(合计) | 9 | 各章节 §三 使用说明 |
| 事件(合计) | 1 | 同上 |

> 合计口径:各章 frontmatter `endpoints`/`events` 之和 = **章节留档覆盖数**。单一可信源 `openapi.yaml`(v0.2.0)共声明 **12** 个 `/ipc` 端点:9 个见第 02 章、1 个见第 01 章附录 A.4(add-002 增量 `open-external`);`list-system-fonts` 与 `get-plantuml-server-url` 已在契约声明,交付章留档待补(见路径清单)。

### 路径清单(跨章节去重,/ql-doc 章节累积后填)

| 方法 | 路径 | 章节 | 说明 |
|------|------|------|------|
| POST | `/ipc/open-file-dialog` | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#11-端点清单) | 弹窗打开并读取 Markdown |
| POST | `/ipc/save-file` | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#12-端点详情本阶段核心通道) | 写盘保存(静默写/另存为双语义) |
| POST | `/ipc/new-file` | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#11-端点清单) | 新建文件(强制另存为) |
| POST | `/ipc/read-file` | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#12-端点详情本阶段核心通道) | 按路径读取文本 |
| POST | `/ipc/watch-file` | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#12-端点详情本阶段核心通道) | 监听外部修改(1s 节流,配事件 `file-external-change`) |
| POST | `/ipc/unwatch-file` | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#11-端点清单) | 取消监听(幂等) |
| POST | `/ipc/pick-directory` | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#11-端点清单) | 目录选择 |
| POST | `/ipc/list-directory` | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#11-端点清单) | 列目录(文件树) |
| POST | `/ipc/open-diagram-window` | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#11-端点清单) | 图表独立窗口 |
| POST | `/ipc/open-external` | [第 01 章 · 附录 A.4](./chapters/chapter-01-markdown-editor.md) | 用系统默认程序打开外部链接(协议白名单 http/https/mailto) |
| POST | `/ipc/list-system-fonts` | 待补(契约已声明) | 枚举系统字体(设置页字体选择) |
| POST | `/ipc/get-plantuml-server-url` | 待补(契约已声明) | 读取 PlantUML 服务器地址配置 |

### 错误码汇总(/ql-doc 章节累积后填)

| HTTP | code | 章节 | 含义 |
|------|------|------|------|
| 404 | FILE_NOT_FOUND | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#14-错误码参考) | 文件不存在 |
| 500 | FILE_READ_FAILED | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#14-错误码参考) | 读取失败 |
| 403 | FILE_WRITE_FAILED | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#14-错误码参考) | 写入失败(可重试) |
| 422 | PATH_INVALID | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#14-错误码参考) | 路径非法 |
| 500 | WATCH_FAILED | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#14-错误码参考) | 监听建立失败 |
| 500 | WINDOW_OPEN_FAILED | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#14-错误码参考) | 窗口创建失败 |
| 422 | UNSUPPORTED_PROTOCOL | [第 01 章 · 附录 A.4](./chapters/chapter-01-markdown-editor.md) | 协议不在 http/https/mailto 白名单 |
| 500 | OPEN_EXTERNAL_FAILED | [第 01 章 · 附录 A.4](./chapters/chapter-01-markdown-editor.md) | 系统默认程序调用失败 |
| 500 | INTERNAL_ERROR | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#14-错误码参考) | 未分类内部错误 |

### 数据模型汇总(/ql-doc 章节累积后填)

| Schema | 章节 | 字段数 | 说明 |
|--------|------|--------|------|
| OpenFileResult | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#13-数据模型schemas) | 2 | 打开结果(path + content) |
| SaveFileRequest | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#13-数据模型schemas) | 2 | 保存请求(content;path 为 null 即另存为) |
| SaveFileResult | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#13-数据模型schemas) | 1 | 保存结果(path) |
| NewFileRequest | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#13-数据模型schemas) | 2 | 新建请求(initialContent / suggestedName) |
| DirEntry | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#13-数据模型schemas) | 3 | 目录项(name / path / isDir) |
| OpenDiagramWindowRequest | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#13-数据模型schemas) | 3 | 图表窗口载荷(title / source / diagramType) |
| Error | [第 02 章](./chapters/chapter-02-autosave-conflict-net.md#13-数据模型schemas) | 3 | 标准错误 {code, message, details};全部 9 个错误响应共用 |

## 术语表

| 术语 | 含义 | 首见章节 |
|------|------|----------|
| | | |

(机器不臆造术语;由 /ql-doc 章节累积或人工补充)

## 关于本书

<details>
<summary>生成方式、版本、新鲜度与严谨性约定(点开展开)</summary>

- **生成:** 器灵工作流 v0.18.0;`/ql-scan`(第一章)+ `/ql-doc`(交付后逐章追加)共同维护,本页**不要手改**。
- **章节结构:** 本章导学 → 正文五章(是什么/快速上手/使用说明/配置与限制/故障排查)→ 本章小结/下一章 → 附录三章(交付留档/章节对比/数据来源与验证);篇由各章 frontmatter `part` 声明。
- **人工撰写:** 章节内 `<!-- manual:ID -->` 块可人工撰写润色,重新生成时自动保留。
- **项目元信息:** 项目名 markdown-editor · 版本 0.1.0 · 总章节数 3 · 包管理器 pnpm · 文档基线 commit d0a7a533(第一章)
- **新鲜度自查:** `git log --oneline <基线>..HEAD` 条目较多说明代码已演进、文档可能过期;项目结构大改后运行 `/ql-scan --force` 重扫。
- **严谨性约定:** ①证据锚点——能力条目附 `文件:行号`,API 以 `openapi.yaml` 为单一可信源 ②未检出显式声明——扫不到写"未检出(Not detected)"+原因,绝不编造 ③推断必须标注"(推断)" ④不画假图——mermaid 只用真实检测值 ⑤密钥扫描——产出不含敏感值。

</details>
