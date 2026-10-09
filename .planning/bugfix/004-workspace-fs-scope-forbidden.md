---
bugfix: 004
slug: workspace-fs-scope-forbidden
status: fixed
fixed_at: 2026-09-28T23:41:22+08:00
severity: major
review: skipped
---

# bugfix-004:白名单外位置的工作区,文件树(含子目录中的 MD 文件)整体索引失败

## 现象

- 用户报告:「打开目录后,无法索引子目录中的 MD 文件」。
- 实际形态(真机取证):工作区在 fs:scope 白名单外(如 `D:\...`)时,plugin-fs 的 `readDir` 被整体拒绝(`forbidden path: ..., maybe it is not allowed on the scope for allow-read-dir permission in your capability file`),文件树根与子目录全部为空;异常被 `toggleNode` 的 catch 与无提示的失败路径吞掉。打开单文件正常——因为 `read_file` 是自定义 command,不走 fs:scope,这正是"能开文件但文件树不出来"的原因。

## 复现路径

- 真机(Tauri dev + WebView2 CDP,页面内直驱 Pinia store):
  - 修复前:`ws.rootPath = 'D:\mdelink-ws'` → `refreshTree()` 抛 `forbidden path: D:/mdelink-ws ...`(四象限探针:scope 内 `$HOME` 全链路正常,scope 外整体 forbidden)
  - 修复后:`invoke('allow_workspace_dir')` → 全链路通过:`tree=[sub, root.md]`、子目录展开 `subChildren=["inner.md"]`、打开子文件 `content="# 子目录文件"`
- 测试:`src/stores/workspace.tree-scope.test.ts`(修复前 2 例以 bug 方式失败:授权调用缺失/错误未传播;修复后 3/3 通过)

## 根因

`src-tauri/capabilities/default.json` 的 `fs:scope` 只静态白名单 `$HOME/**`、`$DOCUMENT/**`、`$DESKTOP/**`、`$DOWNLOAD/**` 四个固定位置;对话框可选择的任意位置工作区不在其中,plugin-fs 的 `readDir`(文件树唯一数据源)被整体 forbidden,且失败无用户可见提示。

- 引入点:phase-1 脚手架期的 capabilities 配置;工作区位置与白名单的交集问题在使用 `D:\` 类目录时必然触发
- 类别:配置缺陷(权限 scope 与功能面不匹配)/ 错误处理缺失(forbidden 被静默吞)

## 修复

| 文件 | 位置 | 变更 |
|------|------|------|
| src-tauri/src/lib.rs | 新增 `allow_workspace_dir` command + generate_handler 注册 | `FsExt::fs_scope().allow_directory(path, true)` 运行时递归放行选定工作区 |
| src/services/fileService.ts | 新增 `allowWorkspaceDir()` | invoke 封装(Web 模式 no-op;失败抛 normalizeError) |
| src/stores/workspace.ts | `chooseWorkspace` | 对话框选定目录后、读目录前调用授权;失败向上传播不静默 |

**提交:** c129e97(`fix(bugfix-004): 选定工作区后运行时授权 fs scope——修复白名单外目录的文件树(含子目录 MD)整体索引失败`)

## 回归验证(fresh evidence)

| 命令 | 结果 | 备注 |
|------|------|------|
| `cargo check`(src-tauri) | PASS | 2.64s(仅既有 dead_code warning) |
| `pnpm vitest run src/stores/workspace.tree-scope.test.ts` | PASS | 3/3(修复前 2 例红) |
| `pnpm test` | PASS | 320/320(33 文件) |
| `pnpm typecheck` / `pnpm build` | PASS | 0 错误 / 9.46s |
| 真机终验(Tauri dev + WebView2 CDP) | PASS | scope 外 `D:\mdelink-ws`:授权后树 2 项、子目录展开 inner.md、打开内容正确 |

## 同类检查

- [x] `grep` 扫描 plugin-fs 其余调用面
- 结论:`readDir` 是 plugin-fs 唯一使用点(tauriListDir);`readTextFile`/`writeTextFile` 等前端 fs API 未使用(文件读写全走自定义 command,不受 scope 限制);`watch_file`(notify crate,自定义 command)不受影响。授权时机唯一(chooseWorkspace),无其他需要放行的入口。

## 遗留与顺带发现

- `allow_workspace_dir` 是第 9 个自定义 IPC command,尚未写入 `openapi.yaml` 契约(12 端点)——契约刷新时补(建议随下次 `/ql-add` 或契约维护一并处理)
- `refreshTree`/`toggleNode` 的失败仍无用户可见提示(本次仅让 chooseWorkspace 的授权错误可传播);文件树加载失败的 UI 呈现属体验增强,DEFERRED
- capabilities 静态白名单保留(兜底安全);运行时授权只加用户明确选择的目录,不扩大默认攻击面

## 旅程日志(≤5 条)

- 用户表述「无法索引子目录中的 MD 文件」与真机表现「整个文件树为空」存在偏差——四象限探针(scope 内/外 × 根/子)把模糊症状钉成了精确事实
- 关键分叉点:`read_file` 不走 fs:scope(解释"开文件正常")而 `readDir` 走(解释"树不出来"),一个 API 面差异解开了全部矛盾
- 真机探针三轮 undefined 折腾:bash 内联转义、CDP 双层 `result.result` 读错层——文件版脚本 + 原始响应打印才定位;此前一轮"undefined"的调用实际已生效(授权已加),险些误判为失败
- 可迁移:WebView2 CDP 直驱 Pinia store 可覆盖对话框类 UI 不可自动化场景(直驱 store 方法等价用户操作)
