---
bugfix: 003
slug: link-jump-overwrites-unsaved
status: fixed
fixed_at: 2026-09-28T15:38:52+08:00
severity: major
review: approved
---

# bugfix-003:文档链接跳转把未保存内容覆盖为磁盘版本(目标为空文件时呈现为「跳转到空文档」)

## 现象

- 用户报告:「文件中的链接跳转功能会跳转到空文档」(add-002 交付的预览区文档链接跳转功能)。
- 可复现形态:链接目标文件已在标签中打开、编辑器里有未保存修改(自动保存默认关闭,`autoSaveEnabled: false`)时,点击指向它的链接 → 标签内容被磁盘版本**静默覆盖**;目标文件为空(新文件的用户内容尚未落盘)时,呈现为编辑器**变成空文档**。

## 复现路径

- 测试:`src/components/PreviewPane.links-e2e.test.ts`「目标已打开且有未保存修改 → 跳转保留未保存内容并进冲突安全网(不覆盖)」(修复前失败 ✗:`expected '# next real content\n' to be '未保存的宝贵修改'`;修复后通过 ✓)
- 真机(Tauri dev + WebView2 CDP,页面内驱动真实 Pinia store):dirty 的 target.md + 从 index.md 点击指向它的链接 → 修复前 content 被磁盘内容覆盖;修复后 content 保留、`status=conflict`、`conflictKind=modified`、目标标签激活

## 根因

`openFileFromPath` 对已打开的 tab 无条件 `upsertTab`(磁盘内容覆盖 + 强制 clean),不保护未保存修改——违反 chapter-02 确立的冲突安全网原则(外部修改对 dirty tab 会进 conflict 由用户决策);add-002 的链接跳转把该函数暴露到高频点击路径,触发面被放大。

- 引入点:`upsertTab` 为 phase-1 旧代码;add-002(`9d55aed`)新增的跳转链路将其暴露为高频路径
- 类别:边界遗漏(安全性原则的不一致应用)

## 修复

| 文件 | 位置 | 变更 |
|------|------|------|
| src/stores/workspace.ts | openFileFromPath / openFile / 新增 guardDirtyTab | 打开动作命中已打开且 dirty 的文件 → 置 conflict/modified + 激活标签(复用既有冲突安全网 UI:AutoSaveBanner 双按钮决策),跳过覆盖;clean 路径行为不变 |

**提交:** 6db9b3f(`fix(bugfix-003): 链接跳转/打开命中已打开的 dirty 文件时进冲突安全网而非静默覆盖`)

## 回归验证(fresh evidence)

| 命令 | 结果 | 备注 |
|------|------|------|
| `pnpm test` | PASS | 317/317(33 文件,含新增 6 例 e2e;修复前该套件以 bug 方式失败 1 例) |
| `pnpm typecheck` | PASS | vue-tsc --noEmit 0 错误 |
| `pnpm build` | PASS | 7.89s |
| 真机终验(Tauri dev + WebView2 CDP) | PASS | dirty 内容保留 + conflict/modified + 目标标签激活 |
| 证伪实验(ql-reviewer 独立执行) | PASS | `git stash` 回退修复后全量重跑,唯一变红 = 新增 dirty 保留用例(精确锁定) |

## 同类检查

- [x] `grep` 扫描同模式代码(`upsertTab` 全部 4 个调用方逐一核对)
- 结论:已修复 2 处——`openFileFromPath`(链接跳转/文件树/暖启动)与 `openFile`(对话框),统一接入 `guardDirtyTab`;`saveMarkdownFile` 后的 upsert(保存成功后磁盘=内存,覆盖幂等)与 `newFile` 的 upsert 语义安全;`newFile` 经系统对话框确认覆盖已打开 dirty 文件的极端场景记为 PRE-EXISTING 边缘(评审 non-critical 3)。

## 遗留与顺带发现

- 空目标文件跳转打开后缺少「此文件为空」的语境提示(UX 增强,DEFERRED)
- 影响面说明:文件树双击 / 暖启动打开已打开的 dirty 文件时,行为同样从「静默覆盖」变为「进冲突」——方向安全,交付说明需提及(评审 non-critical 1)
- `newFile` 对话框确认覆盖已打开 dirty 文件的边缘场景(PRE-EXISTING,评审 non-critical 3)

## 旅程日志(≤5 条)

- 首轮静态推演所有失败路径都有兜底,差点误判「无 bug 可复现」——转向真机取证(WebView2 CDP)而非继续猜
- 真机矩阵探针 v1/v2 误把「目标文档里没有链接」读成「页面导航冲掉编辑器」,制造过一次假复现;修正探针(逐 tab 激活 + 经 `#app.__vue_app__` 直驱 Pinia store)后取得可信事实
- 三交叉锁定根因:7 形态真机矩阵 6 项正常 + 唯一异常(空文件 → 空 tab)+ 代码审查(dirty 无条件覆盖)+ 自动保存默认关闭的事实
- 可迁移:WebView2 用 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333` 启动后接受 CDP 注入,可对 Tauri 应用做运行时取证;Pinia store 可经 `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('<id>')` 直驱
- 真机 HMR 不会重建 Pinia store 闭包,验证新代码必须 Page.reload + 重新打开文件
