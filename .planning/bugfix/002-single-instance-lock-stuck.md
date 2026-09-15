---
bugfix: 002
slug: single-instance-lock-stuck
status: fixed
fixed_at: 2026-09-15
severity: critical
review: approved
---

# bugfix-002:安装后仅首次能打开软件,关闭后再也打不开

## 现象

用户报告:安装后仅首次能打开软件,关闭后双击 exe 无反应。

## 复现路径

1. 安装并首次启动 → 正常。
2. 关闭软件 → `%TEMP%/markdown-editor.lock` 残留(进程退出不删普通文件)。
3. 再次双击 → `OpenOptions::create_new(true)` 返回 `AlreadyExists` → stderr 输出
   `[single-instance] another instance is already running (lockfile already exists). exiting.` → `exit(1)`。

## 根因

自研单实例锁(src-tauri/src/lib.rs `try_acquire_single_instance_lock`,已删)用
`%TEMP%/markdown-editor.lock` + `create_new(true)` 独占创建,并 `mem::forget` 句柄。
实现注释误以为"进程退出释放句柄时 OS 会自动删除文件"——Windows 普通文件不随句柄
关闭消失,lockfile 永久残留,第二次启动永远 `AlreadyExists` → `exit(1)`。

## 修复(提交 7a3a53a,diff `a75d49f..7a3a53a`,分支 ql/phase-1-autosave)

- `src-tauri/Cargo.toml`:+ `tauri-plugin-single-instance = "2.4.4"`(OS 原生命名 mutex,无落盘锁)。
- `src-tauri/src/lib.rs`:删除自研锁整段;builder 最前注册插件,回调解析转发 argv
  (`startup_open_path_from_args`,内部 `skip(1)`)→ `emit("startup-open-file", {path})`。
- `src/services/startupOpen.ts`:+ `onStartupOpenFile(handler)`(listen 封装,Web 返回 no-op)。
- `src/App.vue`:onMounted 注册 handler → `workspace.openFileFromPath`(全局根,任意路由在线)。
- `src/services/startupOpen.test.ts`:+4 例。

## 回归验证(fresh evidence,主会话动态取证)

- 修复前:实例全部退出后 `%TEMP%/markdown-editor.lock` 仍存在;再次启动 exit=1。
- 修复后 4/4:冷启 ✓;暖启动转发 ✓(第二实例带 README.md,首实例 stderr 出现
  `[startup-open] warm-open doc path`,第二实例 exit=0);关闭后无锁残留 ✓;再次启动成功 ✓。
- 单测 223/223 全绿;vue-tsc 0 错;cargo test 3 passed;cargo check 通过;tauri:build MSI+NSIS 成功。

## 独立评审

评审档位:LIGHT→STANDARD(6 文件,核心 diff 约 180 行;触及启动/互斥关键路径,按 STANDARD 完整三结论)。
评审时 HEAD=7a3a53a、worktree clean,主会话验证结论未过期,未重跑重型命令。

### 结论一:契约合规(验收标准)——通过

1. **旧锁删除彻底**:grep 全仓(`src/`、`src-tauri/src`、Cargo.toml、tauri.conf.json)
   `try_acquire_single_instance_lock` / `markdown-editor.lock` 零残留(grep exit=1)。
2. **互斥语义覆盖原场景且无残留产物**:插件 Windows 实现
   (`~/.cargo/registry/src/.../tauri-plugin-single-instance-2.4.4/src/platform_impl/windows.rs:74-77`)
   用 `CreateMutexW(null, TRUE, "{identifier}-sim")` 命名内核 mutex——内核对象生命周期随
   进程退出自动释放,不存在落盘文件,原 bug 机制上不可能复现。评审者本机 `%TEMP%` 下
   亦无锁残留。第二实例 `ERROR_ALREADY_EXISTS` → `FindWindowW` + `WM_COPYDATA` 转发 +
   `exit(0)`(windows.rs:86-113),完整覆盖"第二实例退出"的原互斥语义并增强为 argv 转发。
3. **skip(1) 正确性(核心争议点)**:插件转发 args 来自
   `std::env::args().collect::<Vec<String>>().join("|")`(windows.rs:102),Windows 上
   首项为第二实例 exe 路径(程序名);接收端 `WM_COPYDATA` 先分离 cwd 再取剩余为 args
   (windows.rs:186-191)→ 回调收到的 `args[0]` 是程序名。`startup_open_path_from_args`
   内部 `args.skip(1)`(src-tauri/src/lib.rs:47)与之精确对应,不会跳掉真路径。
   主会话"暖启动转发 ✓"动态取证与此互证。
4. **emit payload 一致**:Rust `json!({"path": p})`(lib.rs:80)↔ 前端
   `listen<{ path: string }>` + `e.payload?.path`(src/services/startupOpen.ts:28-31)。
5. 我亲自抽查 `pnpm vitest run src/services/startupOpen.test.ts` → 7/7 通过(3 旧 + 4 新)。

### 结论二:正确性——通过(附 4 项非阻断发现)

- **冷启/暖启双链路无双开**:插件回调仅在收到 `WM_COPYDATA`(即存在第二实例)时触发;
  首实例冷启自己的 argv 走 `STARTUP_OPEN_PATH` 暂存(lib.rs:38-40)+ `take_startup_open_path`
  一次性消费(lib.rs:57-60,`Option::take`),HomeView.vue:106 取走即清空。冷启时无 emit,
  App.vue 的 listener 不触发;两条链路载体不同(Once static vs 事件),互不重入。
- **插件注册位置**:builder 第一个 `.plugin()`(lib.rs:73),满足官方"尽早注册"要求。
- **版本兼容**:Cargo.lock 锁定 tauri-plugin-single-instance 2.4.4 ↔ tauri 2.11.5,
  主版本一致;`tauri.conf.json` identifier `com.markdowneditor.app` 非空(mutex/窗口类名基底)。
- **测试真实性**:4 个新用例真实驱动 captured 回调,断言 handler 转发、payload 缺 path 不调用、
  Web no-op、unlisten 透传——非"只断言 mock 被调用"的空测试。

非阻断发现(minor):

1. **emit-早于-listen 竞态**(src-tauri/src/lib.rs:77-81 + src/App.vue:20-23):第二实例若在
   首实例前端 `onMounted` 注册 listen 之前转发(冷启后数秒内),`emit` 事件无人接收即丢失,
   该次双击的文档不打开;不阻塞启动、不违反单实例。旧方案(第二实例直接 exit(1) 无转发)
   同样丢此场景,无回归。可接受的边缘退化。
2. **插件固有启动窗口期**(插件 windows.rs:86-117):首实例 `CreateMutexW` 成功与消息窗口
   `CreateWindowExW` 就绪之间的毫秒级窗口内,第二实例命中 `ERROR_ALREADY_EXISTS` 但
   `FindWindowW` 失败 → 既不转发也不退出,理论上可双实例。官方插件固有边界,非本 diff 引入。
3. **回归锁定缺口**:前端单测 mock `listen`,若 Rust 侧 `.plugin(tauri_plugin_single_instance::init)`
   注册被误删,前端测试仍全绿;跨进程暖启动链路仅由本次一次性 E2E 动态取证锁定。
   建议后续在测试注释或文档标注此边界(不阻断)。
4. **WM_COPYDATA 分隔符**(插件 windows.rs:102):args 以 `|` 拼接,路径含 `|` 会破坏解析——
   Windows 文件名禁止 `|`,实际不可触发;仅记录。

Rust 侧 cargo check / cargo test / tauri:build 由主会话验证 PASS;HEAD 未变、worktree clean,
无 STALE/dirty_worktree/misleading_success_output 迹象,未重跑。

### 结论三:代码库一致性——通过

- **C1 服务层封装**:App.vue 仅 import `@/services/startupOpen`,`listen` 封装在 services 层;
  grep 非 services 目录唯一 `@tauri-apps` 引用为存量 `src/markdown/plantumlRehype.ts`
  (pre-existing,不在本次 diff)。
- **C2 环境降级**:`onStartupOpenFile` 有 `if (!isTauri()) return () => {}` 纯 Web 降级
  (src/services/startupOpen.ts:26)。
- **C3 安全底线**:无 `console.log` 残留;未触碰预览渲染管线;无密钥/地址入库。
- 注释风格(中文注释、bugfix 编号引用、`eprintln!` 诊断日志)与 bugfix-001 既有惯例一致。

### 一句话总评

根因诊断准确、修复方向正确:用官方 OS 原生 mutex 插件替换落盘 lockfile,机制上根除了
"残留产物挡启动"一类问题;核心争议点 skip(1) 经插件源码核实正确,双链路无双开,
4 项 minor 均为边缘退化或插件固有边界,不阻断交付。

---

## 同类检查

- [x] `grep -rn "env::args|process.argv|lock"` 扫描(src/、src-tauri/src)
- 结论:argv 消费仅 startup_open_path_from_args 一处(单点);落盘锁已全仓根除,无潜伏同类。

## 遗留与顺带发现(评审 minor,均登记)

- M1 emit-早于-listen 竞态:冷启后数秒内暖启动转发可能无人接收(旧方案同样丢,无回归)
- M2 插件毫秒级启动窗口期(官方固有边界)
- M3 跨进程暖启动链路无自动化测试锁定(依赖一次性 E2E 取证)
- M4 WM_COPYDATA `|` 分隔符边缘(Windows 文件名禁 `|`,不可触发)
- 顺带闭环:bugfix-001 遗留 N2(暖启动 argv 转发)随本修复完成 ✓

## 旅程日志(≤5 条)

- 症状"关闭后打不开"第一嫌疑是锁文件残留,但最初 %TEMP% 检查不存在——因用户可能手删过;转向事件日志(无记录)+ 亲自动态复现,force-kill 后锁残留确凿,复现链闭合。
- 复现脚本两次被 Git Bash 的 `/IM` → 路径转换坑了(taskkill 失败误判实例已死);`//IM` 双斜杠是 MSYS 下调用 Windows 命令行参的正解。
- 自研锁注释里"OS 自动删除 lockfile"的说法本身就是根因——Windows 普通文件不随句柄关闭消失(需 FILE_FLAG_DELETE_ON_CLOSE);当注释与 OS 语义矛盾时,信 OS 语义。
- 修复选型一次到位:该锁属"设计错"而非"逻辑错",打补丁(退出清理/陈旧检测)不如换官方插件;插件自带 argv 转发让 bugfix-001 遗留 N2 一并闭环。
