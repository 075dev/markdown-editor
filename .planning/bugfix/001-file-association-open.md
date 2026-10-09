---
bugfix: 001
slug: file-association-open
status: fixed
fixed_at: 2026-09-15
severity: major
review: approved
---

# bugfix-001:默认打开方式启动时不打开文档

## 现象

- 用户报告:软件作为系统"默认打开方式"时,双击 .md 文件只启动软件窗口,不打开该文件。

## 复现路径

- 测试(修复前全红,修复后全绿):
  - `src-tauri/src/lib.rs` 内嵌 `startup_open_tests`(3 例)—— 修复前编译失败 E0432(函数不存在),即"该能力不存在"的复现证据
  - `src/services/startupOpen.test.ts`(3 例)—— 修复前 `Failed to resolve import "./startupOpen"`
  - `src/views/HomeView.startup-open.test.ts`(2 例)—— service 落地后、接线前以断言失败红(标签未被打开),接线后绿
- 静态证据:修复前 `grep -rn "args\|argv" src-tauri/src` 仅命中 invoke_handler 注册列表;tauri.conf.json 无 fileAssociations。

## 根因

应用全链路不消费系统"打开方式"传入的命令行文档路径:第二实例 argv 随单实例锁失败 `exit(1)` 丢弃,首实例从不读取 `std::env::args()`、无对应 IPC 命令,前端无启动打开逻辑,打包配置未声明文件关联——因此双击文件只表现为启动窗口。

- 引入点:初始脚手架即缺失(非回归)
- 类别:边界遗漏(功能缺失)

## 修复

| 文件 | 位置 | 变更 |
|------|------|------|
| src-tauri/src/lib.rs | run() 前 | 新增 `STARTUP_OPEN_PATH` 静态 + `startup_open_path_from_args`(纯解析,扩展名白名单)+ `take_startup_open_path` 命令(take 一次性) |
| src-tauri/src/lib.rs | run() | 单实例锁成功后解析 argv 暂存;invoke_handler 注册新命令 |
| src/services/startupOpen.ts | 新增 | `takeStartupOpenPath()` 封装(Web 环境恒 null,宪法 C1/C2) |
| src/views/HomeView.vue | :101 onMounted | 取路径 → `workspace.openFileFromPath(p)`(失败静默) |
| src-tauri/tauri.conf.json | bundle | 声明 `fileAssociations`(md/markdown/mdx/txt,Editor)—— 安装后系统正式注册关联 |

**提交:** a5582d4(`fix(bugfix-001): 默认打开方式启动时消费文档路径`)

## 回归验证(fresh evidence)

| 命令 | 结果 | 备注 |
|------|------|------|
| `./node_modules/.bin/vue-tsc --noEmit` | PASS | 0 错 |
| `./node_modules/.bin/vitest run` | PASS | **219/219**(基线 214 + 新增 5) |
| `./node_modules/.bin/vite build` | PASS | built in 8.61s |
| `cargo test`(src-tauri) | PASS | 3 passed(启动路径解析) |
| `cargo check` | PASS | Finished 1.75s,无新增 warning |
| tauri.conf.json JSON 校验 | PASS | node JSON.parse 合法 |

## 同类检查

- [x] `grep -rn "env::args|process.argv" src-tauri/src src` 扫描
- 结论:无其他 argv 消费点,无潜伏同类。暖启动场景(实例已运行时双击)为同根因未覆盖分支,登记为遗留(N2)。

## 遗留与顺带发现

- **N2 暖启动转发**(建议下一迭代):应用已运行时双击 .md,第二实例 exit(1) 丢弃 argv,首实例无感知。建议引入官方 `tauri-plugin-single-instance`(自带 argv 转发回调)或自建转发,需与现有自研单实例锁协调。
- **N3 安装级实测**:fileAssociations 在重新打包安装后生效,下次 bundle 后补"安装 → 设默认 → 双击 → 文件打开"手工验证。
- N1 Rust 接线未被测试锁定(仅代码评审防线)/ N4 `args()` 非 UTF-8 panic 与字面 `.md` 文件名边缘 / N5 stderr 打印用户路径的脱敏提示。

## 旅程日志(≤5 条)

- 复现采用 TDD 红:功能缺失类 bug 的复现即"引用不存在符号的失败测试",编译/解析错误为合法红;service 落地与接线之间还产生了"以 bug 方式断言失败"的第二段红,证据链完整。
- 修复设计避开"setup emit + 前端 listen"启动竞态:改用前端就绪后 invoke 取走(take 一次性),静态变量写入发生在 Builder::run() 之前,任意时序都取得到。
- 前端 `workspace.openFileFromPath`(文件树既有能力)直接复用,修复只做"把路径递给它",增量最小。
- 测试 helper 的 `impl Iterator` 隐式捕获生命周期编译失败一次(E0700),显式标注 `+ 'a` 解决,与根因无关。
- **打包实测(2026-09-15,补 N3 部分)**:fileAssociations 的中文描述触发 WiX `LGHT0311`(MSI 数据库 codepage 1252 无中文字符),MSI 打包失败;name/description 改英文后 MSI + NSIS 双双打包成功(安装器 en-US 默认 codepage 与非 ASCII 字符串冲突,tauri wix 的已知约束)。d2c7774

---

## 独立评审

**verdict: approved**

- critical 发现:0
- non-critical 发现:5(N1~N5,均不阻断,含 2 项后续修复建议)

### 结论一:契约合规(验收标准)——通过

根因五点逐一对症,证据均指向 diff 或本评审亲验输出:

1. **首实例消费 argv**:`run()` 在单实例锁**成功之后**调用 `startup_open_path_from_args(std::env::args())` 暂存到 `STARTUP_OPEN_PATH`(src-tauri/src/lib.rs,run() 内 bugfix-001 注释块)。解析放在锁之后,保证只有首实例暂存,第二实例路径仍在 exit(1) 处丢弃——与根因结论一致。
2. **IPC 命令**:`take_startup_open_path`(`Mutex::take()` 一次性语义)已注册进 `invoke_handler`(diff 中 `+ take_startup_open_path` 行)。
3. **前端启动打开**:HomeView.vue `onMounted` → `takeStartupOpenPath().then(p => workspace.openFileFromPath(p))`。
4. **Web 降级**:src/services/startupOpen.ts `isTauri()` 为 false 时直接返回 null 不 invoke(宪法 C2 合规)。
5. **文件关联**:src-tauri/tauri.conf.json `bundle.fileAssociations`。字段逐一核对 tauri-utils **2.9.3**(Cargo.lock 锁定版)`config.rs:1185-1200` 的 `FileAssociation`:`ext: Vec<AssociationExt>`、`name`、`description`、`role: BundleTypeRole` 全部吻合;`"Editor"` 是 `BundleTypeRole` 合法枚举值且为默认(config.rs:1103-1106)。字段名无误。

**链路闭合与时序(聚焦点 1)**:静态变量在 `Builder::run()` 之前写入,前端任意时点 invoke 都能取到——不存在"前端先 invoke 后写入"的启动竞态。`take` 语义使路径只能被消费一次:路由 "/" 即 HomeView 且 catchall redirect "/"(src/router/index.ts:5-16),启动必经挂载;之后去 /settings 再返回的重复挂载只会取到 null,不会重复开标签。读盘链路:`openFileFromPath`(src/stores/workspace.ts:489-495)→ `readTextFileRaw` = fileService `readTextFile`(src/services/fileService.ts:281-285)→ `invoke('read_file')` → lib.rs:443-445 `std::fs::read_to_string`,**无路径白名单**,自定义命令不受 fs scope($HOME/$DOCUMENT/... capabilities/default.json)约束——故关联启动的任意盘符绝对路径可打开,读盘失败返回 null → `openFileFromPath` 返回 false → 静默不阻塞启动。链路闭合。

### 结论二:正确性——通过(附 5 项非阻断发现)

- **回归测试锁定情况(聚焦点 2)**:三组共 8 例。整链改回旧代码时:lib.rs 内嵌测试因引用被删函数而**编译失败**(红),HomeView.startup-open.test.ts 因标签未打开而**断言失败**(红)。锁定有效。但存在锁定颗粒度缺口(见 N1)。
- 已 PASS 声明未重跑(遵守不重复已证结论);做了一项廉价一致性抽查:当前 `src/**` 计 219 个 `it/test` 用例(27 个测试文件),与声明 "vitest 219/219" 吻合。

**发现清单**:

| 级别 | 编号 | 发现 | 证据 |
|------|------|------|------|
| non-critical | N1 | Rust 侧"接线"未被测试锁定:若仅删除 run() 内解析调用与 invoke_handler 注册、保留纯函数与单测,全部 219 例仍绿(Rust 单测只测纯函数,前端测试 mock 了 `@/services/startupOpen` 与 `invoke`)。实际回归风险低(typecheck/编译可兜底一部分),但严格意义上"暂存+注册"两条接线只有代码评审防线 | startupOpen.test.ts 全程 `vi.mock('@tauri-apps/api/core')`;HomeView 测试 `vi.mock('@/services/startupOpen')`;lib.rs 单测仅 import `startup_open_path_from_args` |
| non-critical | N2 | **暖启动场景 bug 依旧**:应用已运行时再双击 .md,第二实例在单实例锁失败处 exit(1),argv 随之丢弃,首实例无任何感知——用户看到的仍是"双击无反应"。本次修复只覆盖冷启(与 bug 报告主症状"只启动软件窗口"吻合,故不阻断),但这是"默认打开方式"的高频路径,建议后续迭代:第二实例 exit 前把 argv 转发给首实例(如命名管道/参数文件 + 事件) | lib.rs 单实例锁分支(原有代码,本 diff 未动);根因结论自认"第二实例 argv 随单实例锁失败 exit(1) 丢弃" |
| non-critical | N3 | 端到端无实测证据:`fileAssociations` 仅在重新打包的 MSI/NSIS 安装后才生效,验证矩阵(vue-tsc/vitest/vite build/cargo test/check)均为代码级,无"安装→设默认→双击 .md→文件打开"的记录。链路经本评审静态核查闭合,但安装器实际注册行为与 Explorer 传入 argv 形态未取证,建议下次 bundle 后补一次手工双击验证 | 声明的验证清单中无安装级条目;tauri.conf.json 的 fileAssociations 为打包期配置 |
| non-critical | N4 | `std::env::args()` 遇非 UTF-8 参数会 panic(极端边缘,可用 `args_os` + lossy 更稳);另字面名为 `.md` 的文件 `Path::extension()` 返回 None 会被拒。均属罕见边缘,记录备查 | lib.rs `startup_open_path_from_args` 实现;Rust `std::env::args` 语义 |
| non-critical | N5 | `eprintln!("[startup-open] ...")` 会把用户文件路径打到 stderr。C3 只禁 console.log(JS)且 lib.rs 既有 12 处 eprintln 先例,不算违规,仅提示:若未来引入日志脱敏策略需一并处理 | lib.rs run() 内新增行;`grep -c eprintln lib.rs` = 12(含新增) |

- 安全核查:argv 路径仅经 `read_file` 读文本,内容仍走既有 rehype-sanitize 管线渲染,无新增 XSS 面;`take_startup_open_path` 仅暴露"一条路径字符串"给受信前端,无提权。C1:本次新增 invoke 封装于 src/services/startupOpen.ts,views 无直接 `@tauri-apps` 导入(src/markdown/plantumlRehype.ts:53 的动态 import 系既有代码,不在本 diff)。

### 结论三:代码库一致性——通过

- 命名/分层:`startupOpen.ts` 服务封装、Rust snake_case 命令、Vue view 只编排,均与既有 fileService/fontService 惯例一致。
- 注释带 `bugfix-001` 锚点与"复现(bugfix-001)"测试头注,与 06e9134 修复轮风格一致。
- 测试先行注释("先于实现编写")在 lib.rs 内嵌测试中保留为描述性文字,无误导。

### 一句话总评

冷启链路(argv 暂存 → take 一次性消费 → 打开标签)闭合且时序可靠,关联配置字段与 Tauri 2.9.3 schema 逐字吻合,0 critical 通过;遗留暖启动转发(N2)与安装级实测(N3)两项跟进项,建议登记到下一迭代。
