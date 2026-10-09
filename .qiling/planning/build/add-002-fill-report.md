# add-002 填充报告 —— 文档链接跳转

日期:2026-09-21 | 分支:ql/phase-1-autosave | 基线 9339b1c → 实现 9d55aed | 模式:sequential(3 worker 串行派发)

> 执行说明:协调器嵌套派发被环境阻断(子代理无再派发工具),主会话承担协调职责,按 T1 → T2 → T3 顺序直接派发 ql-builder-worker,波次依赖语义保持(T1 ∥ T2 无文件交集,T3 依赖两者)。

## 任务清单与完成情况

### T1 外部链接打开 —— 完成(worker:ql-builder-worker)
- src-tauri/Cargo.toml:`open = "5"`(唯一新依赖,解析为 5.4.4)
- src-tauri/src/lib.rs(+76):`validate_external_target` 纯函数(http/https/mailto 大小写不敏感白名单)+ `open_external` command(`UNSUPPORTED_PROTOCOL:` / `OPEN_EXTERNAL_FAILED:` 前缀错误)+ generate_handler 注册 + 3 单测
- src/services/externalLinks.ts(新):`openExternal()` —— isTauri → invoke,失败 normalizeError;web → window.open('_blank','noopener')
- worker 验证:cargo check 0 error / cargo test 6/6 / typecheck 0 错 / 定向 vitest 5/5

### T2 标题锚点 id 注入 —— 完成(worker:ql-builder-worker)
- src/markdown/headingAnchors.ts(新):rehype 插件 + `slugifyHeading` 导出;slug 规则:递归收集文本 → ASCII 小写(不用 toLowerCase,避免波及非 ASCII)→ 空白折叠 `-` → 删 ASCII 标点(0x21-0x7E 中排除字母数字-_,非 ASCII 全保留)→ 空结果兜底 `heading`;每次 process 独立 Map 去重(重名 -1/-2),显式 id 不覆盖但计入去重空间
- src/markdown/pipeline.ts:headingAnchors 挂载于 rehypeSanitize 前;**sanitizeSchema 增 `clobberPrefix: ''`**(实测:id 本在 defaultSchema 全局白名单,真正拦路的是 `user-content-` clobber 前缀;已附注释与集成测试锁定)
- worker 验证:定向 24/24 / typecheck 0 错 / 全量 259/259

### T3 预览链接点击路由 —— 完成(worker:ql-builder-worker)
- src/services/errors.ts:QlErrorCode/CODE_PREFIX_RE 收录 UNSUPPORTED_PROTOCOL、OPEN_EXTERNAL_FAILED(T1 遗留顺带闭环);externalLinks.test.ts 两处断言同步真实码
- src/markdown/linkResolution.ts(新):`classifyPreviewLink`(anchor/external/document/ignored 四分支,大小写不敏感,decode 容错)+ `resolveDocumentHref`(decode → 剥锚点 → 盘符绝对/根相对/当前文档目录三分辨 → `.`/`..` 消解 → 缺扩展名补 .md,统一反斜杠归一)
- src/components/PreviewPane.vue:bodyRef 一次性 click 事件委托(挂载/卸载配对);命中 `<a>` 一律 preventDefault;href 取 getAttribute(避免 base URL 绝对化污染);anchor → 枚举 [id] 精确比较(jsdom 无 CSS.escape,语义等价且防选择器注入,偏离任务书字面已注明)scrollIntoView smooth;external → openExternal,失败 saveNotice error;document → rootPath/currentPath/isTauri 区分提示后 openFileFromPath
- AutoSaveBanner 结论:saveNotice.message 原样透传(AutoSaveBanner.vue:82 实证),零适配
- worker 验证:定向 68/68 / typecheck 0 错 / 全量 311/311

## 主会话亲测(fresh evidence,提交 9d55aed 后)

pnpm typecheck ✅ | pnpm test 311/311 ✅(4.20s)| pnpm build ✅ 7.71s | cargo check ✅(1 存量 warning)

详单见 add-002-verification.md。

## 契约修订待办

无——契约(openapi.yaml 0.2.0 + event-flow 场景 4)先行提交(3432a0b),实现逐条对照,无漂移、无临场改约。

## 遗留与风险(供评审关注)

1. `clobberPrefix: ''` 放开 raw HTML id/name 不加前缀——本地单人文档场景风险评估可接受,多租户/远程内容场景需重估(T2 worker 注明)
2. ftp 等白名单外协议按契约落 document 分支(读盘失败走状态栏提示),契约原文如此
3. resolveDocumentHref 反斜杠归一假定 Windows 优先平台(AGENTS.md 平台优先级),跨平台壳需评审
4. Web 模式 document 分支判定 `!isTauri()` 固定提示"仅桌面支持",Web 端未来引入真实路径体系时重访
5. lint 通道存量损坏(@eslint/js 缺失),PRE-EXISTING 未代装(宪法禁新增依赖未走修订流程)
