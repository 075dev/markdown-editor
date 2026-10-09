---
bugfix: 005
slug: file-open-scope-save-forbidden
status: fixed
fixed_at: 2026-10-09T11:30:00+08:00
severity: critical
review: skipped
---

# bugfix-005:文件关联/暖启动/链接跳转打开的文件无法保存(写盘 forbidden)

## 现象

- 用户报告:「没办法保存文件」。
- 实际形态(真机取证):经 `openFileFromPath` 打开的文件(系统"打开方式"双击、
  single-instance 暖启动转发、预览内文档链接跳转)编辑后 Ctrl+S/自动保存/失焦保存
  全部失败,状态条报:
  `保存失败:forbidden path: D:/..., maybe it is not allowed on the scope for 'allow-write-text-file' permission in your capability file`
  文件能正常打开、能编辑、预览正常——唯独写不进磁盘(mtime 不变)。
- 对照组:同会话里经对话框(Ctrl+O/另存为/新建)或"打开目录"工作区树打开的文件
  保存一切正常——所以日常在 workspace 里干活发现不了,双击关联打开必现。

## 复现路径

- 真机(Tauri dev + WebView2 CDP 直驱 Pinia store,探针脚本 `scripts/cdp-eval.mjs`):
  - scope 外文件 `D:/mdelink-ws-probe/bugfix-005-repro.md`(修复前):
    `openFileFromPath → true`(打开成功)→ `updateActiveContent → saveActive → false`,
    `lastSaveError = forbidden path ...`(INTERNAL_ERROR 归类,见遗留#1),磁盘 mtime 不变
  - scope 内对照 `C:/Users/075/Documents/bugfix-005-repro-control.md`:保存成功,mtime 更新
  - 修复后:同一外置文件 `saveActive → true`、`status: clean`、磁盘内容确认写入;
    端到端暖启动(第二实例带文档路径启动 → single-instance 转发 → 打开 → 编辑 → 保存)落盘成功
- 测试:`src/stores/workspace.open-scope.test.ts`(修复前用例 1 以 bug 方式失败:
  `openFileFromPath` 无任何 `allow_workspace_dir` 授权调用;修复后 2/2 通过)

## 根因

读写两条 IPC 通道的 fs scope 待遇不对称:读盘走自定义 command `read_file`
(不走 fs:scope,任何路径都能读),保存走 plugin-fs `writeTextFile`(受
capabilities `fs:scope` 白名单限制);而 fs scope 的运行时授权只有两个入口——
plugin-dialog 选定路径后自动 `allow_file`/`allow_directory`,以及
`chooseWorkspace` 里的 `allow_workspace_dir`(bugfix-004,仅目录递归)。
`openFileFromPath` 打开的文件两条都不占:未经对话框、也未选工作区,
于是"能打开(自定义读)但永远 forbidden(plugin-fs 写)"。

- 引入点:bugfix-001/002(文件关联、暖启动)引入 `openFileFromPath` 消费链路时,
  该链路只接了自定义 `read_file` 读盘;bugfix-004 的同类检查误判
  「文件读写全走自定义 command,不受 scope 限制」(fileService 骨架期起
  `tauriSaveFile` 就用 plugin-fs `writeTextFile`),扫描漏过了保存链路
- 类别:边界遗漏(授权入口未覆盖全部打开路径)/ 配置缺陷(fs:scope 与功能面不匹配,
  同 bugfix-004)

## 修复

| 文件 | 位置 | 变更 |
|------|------|------|
| src-tauri/src/lib.rs | `allow_workspace_dir` | 按 `is_file()` 分支:单文件 `allow_file` 精确放行,目录维持 `allow_directory(recursive)` |
| src/stores/workspace.ts | `openFileFromPath` | 读盘前对目标路径 invoke 授权;失败不阻断打开(读不受影响,保存失败由 saveNotice 链路呈现) |
| src/services/fileService.ts | `allowWorkspaceDir` 注释 | 更新为「目录递归 / 单文件精确」双语义说明 |
| src/components/PreviewPane.links.test.ts | fileService 部分 mock | `allowWorkspaceDir` 纳入可控 mock(真实现的动态导入超出 flushPromises 冲刷范围,见旅程日志) |
| scripts/cdp-eval.mjs | 新增 | WebView2 CDP 求值探针(复现/终验工具,沿用 bugfix-004 方法) |

**提交:** 见 git log `fix(bugfix-005): ...`

## 回归验证(fresh evidence)

| 命令 | 结果 | 备注 |
|------|------|------|
| `pnpm vitest run src/stores/workspace.open-scope.test.ts` | PASS | 2/2(修复前用例 1 红:无授权调用) |
| `pnpm test` | PASS | 337/337(37 文件,含 2 例新增回归) |
| `pnpm typecheck` / `pnpm build` | PASS | 0 错误 / 7.92s |
| `cargo check`(src-tauri) | PASS | 1.58s(仅既有 dead_code warning) |
| 真机终验(Tauri dev + CDP) | PASS | scope 外文件保存落盘(mtime+内容确认);暖启动端到端(第二实例转发→打开→编辑→保存)落盘成功 |

## 同类检查

- [x] `grep` 扫描 plugin-fs 全部调用面
- 结论:`writeTextFile` 两处(tauriSaveFile/tauriNewFile)——suggestedPath 直写目标
  即本次修复的 openFileFromPath 路径(打开时已授权),对话框路径由 plugin-dialog
  自动授权;`readTextFile`(tauriOpenFile)与 `readDir`(tauriListDir)均经对话框,
  自动授权覆盖。打开入口共四个:openFile/newFile(对话框✓)、openFileFromPath
  (本次修复✓)。无其他未授权写盘路径残留。

## 遗留与顺带发现

- **saveTab 二次规范化降级错误码**:fileService 抛出的 QlError(`{code, message}`
  分离结构)在 `saveTab`/`resolveConflictKeepMine` 里被再次 `normalizeError`,
  message 无 `CODE:` 前缀时按文本模式重判——`forbidden path...` 不含
  denied/readonly/占用 等关键词,被降级为 `INTERNAL_ERROR`。后果:useAutoSave 的
  可重试判别(`FILE_WRITE_FAILED/FILE_READ_FAILED`)失真,真实瞬态写失败可能
  不进重试链。本次不修(与根因无关,禁止顺带重构),建议单独 bugfix
- capabilities 静态白名单保持不变(兜底安全);运行时授权仅对用户主动打开的
  文件精确放行,不扩大攻击面
- `allow_workspace_dir` 与 bugfix-004 遗留项相同:尚未写入 openapi.yaml 契约
  (12 端点),契约刷新时一并补

## 旅程日志(≤5 条)

- bugfix-004 报告的同类检查结论「文件读写全走自定义 command」是错的——它只对了一半
  (读确实走自定义 command,写一直是 plugin-fs),这个错误结论让本次 bug 在上轮
  扫描中漏网。教训:同类检查的 grep 断言要落到调用点清单,不能凭报告记忆
- 四象限探针(scope 外/内 × 打开/保存)一次定位:打开✓保存✗(scope 外)与
  打开✓保存✓(scope 内)的差异把根因钉死在写盘通道的 scope 检查上
- CDP 探针第一轮翻车:反斜杠路径经 bash→argv→JS 三层转义后变成 os error 123
  (无效路径语法);改正斜杠路径绕开全部转义层——Windows API 接受正斜杠
- 修复引入的测试连锁:PreviewPane.links 部分 mock 下,allowWorkspaceDir 真实现的
  `@tauri-apps/api/core` 动态导入首次加载超出 flushPromises 冲刷范围(3 例假失败)。
  可迁移:部分 mock fileService 的测试,凡新增 IO 方法都应同步纳入 mock 缝隙
