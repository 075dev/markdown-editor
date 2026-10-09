# 验证报告(Verification)—— add-002 文档链接跳转

- status: passed
- 分支:ql/phase-1-autosave,HEAD = 9d55aed,评审 diff 锚点 9339b1c(`git diff 9339b1c..HEAD` = 15 文件:13 实现 + 2 契约)
- 日期:2026-09-21
- 验证方式:A 组命令由主会话在实现提交(9d55aed)后亲历执行(fresh evidence);worker 定向验证记录如实转述并标注来源

## 一、A 组:命令验证矩阵

| # | 命令 | 结果 | 关键数字/证据 |
|---|------|------|--------------|
| A1 | `pnpm typecheck` | PASS | 主会话亲测 exit 0,0 错误 |
| A2 | `pnpm test` | PASS | 主会话亲测 **311/311 通过,32 文件**,4.20s(基线 235 → +76) |
| A3 | `pnpm build` | PASS | 主会话亲测 `✓ built in 7.71s`;chunk>500kB 提示为存量(mermaid 体积),非本次引入 |
| A4 | `cargo check`(src-tauri/) | PASS | 主会话亲测 `Finished dev profile in 0.32s`;唯一 warning = `health_url` dead_code → PRE-EXISTING |
| A5 | `pnpm lint` | NOT_RUN | PRE-EXISTING:@eslint/js 未安装,eslint 无法启动(T3 worker 复核,与 phase-1 verification.md A3 同源环境缺口) |
| A6 | `cargo test`(src-tauri/) | PASS | worker 执行:6 passed(新增 open_external_tests 3 + 既有 startup_open_tests 3 无回归);主会话未复跑,证据归属 worker |

## 二、契约符合性摘要(详评由独立评审承担)

- 新端点 `/ipc/open-external`:Rust command open_external(白名单二次校验 + open crate)+ externalLinks service(web 降级)——T1
- 无新事件;x-ql-events 不变
- 新错误码 UNSUPPORTED_PROTOCOL / OPEN_EXTERNAL_FAILED:契约 enum、Rust "CODE: message" 前缀、errors.ts QlErrorCode/CODE_PREFIX_RE 三处对齐
- 行为契约:event-flow.md add-002 细则 1-4(分类/解析/slug/Web 降级)由 T2/T3 实现与测试覆盖

## 三、测试增量构成

| 套件 | 用例 | 覆盖 |
|------|------|------|
| externalLinks.test.ts | +5 | web 传参 noopener / tauri invoke 传参 / 错误码映射 |
| headingAnchors.test.ts | +19 | slug 规则 6 + 插件 9 + 渲染集成 5(含 clobberPrefix 锁定) |
| linkResolution.test.ts | +40 | 分类全分支 / 相对解析 / 盘符归一 / 中文 decode / 补扩展名 |
| PreviewPane.links.test.ts | +12 | 三分支委托 + ignored,均断言 preventDefault |
| open_external_tests(Rust) | +3 | 白名单大小写 / 危险协议拒绝 / 裸串拒绝 |
