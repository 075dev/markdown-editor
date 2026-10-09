---
task: add-005-fill-w1 (render_kuml Rust 侧)
wave: 1
worker: ql-builder-worker
status: success
---

# W1 报告:tauri command `render_kuml`

## 变更文件清单

- `src-tauri/src/lib.rs`(唯一代码变更,+316/-1):
  - invoke_handler 列表注册 `render_kuml`(原 169 行附近)
  - 新增「kUML 渲染」节(位于 PlantUML 节之后、测试模块之前)
  - 新增 `#[cfg(test)] mod render_kuml_tests`(10 个用例)
- `.qiling/planning/build/add-005-fill-w1.md`(本报告)

未触碰 src/**、package.json、契约文件;未执行 git commit/branch(按任务卡留在工作区)。

## 实现要点

- **契约**:`invoke('render_kuml', { source })` → `Ok({ svg })`(以 `<svg` 开头的完整文档)或 `Err("CODE: message")`。命令签名 `async fn render_kuml(source: String) -> Result<KumlRenderOk, String>`,`KumlRenderOk { svg: String }` serde 序列化为 `{ "svg": ... }`。
- **CLI 探测**:`KUML_CANDIDATES = ["kuml", "kuml.exe", "kuml.cmd", "kuml.bat"]`,复用库内 `which_first`(裸名 + .exe,逐 PATH 目录 `is_file()`)。`.cmd`/`.bat` 命中后经 `Command::new("cmd").arg("/C").arg(path)` 调起(`kuml_needs_cmd_wrapper` 判定,大小写不敏感)。
- **临时文件**:source 写入 `temp_dir()/markdown-editor-kuml-<pid>-<纳秒>/diagram-<纳秒>.kuml.kts`(pid + 纳秒,并发调用不碰撞)。
- **执行**:`kuml render <input> --format svg`;stdout/stderr 均 piped,由两个独立线程读入(防止管道写满 + try_wait 互等死锁);Windows 加 `CREATE_NO_WINDOW = 0x08000000` creation_flags(`#[cfg(windows)]`,std `CommandExt`,无新依赖)。
- **超时**:spawn 后 100ms 间隔轮询 `try_wait`,60s 上限,超时 `kill()` + `wait()` 回收后返回 `KUML_RENDER_FAILED`。
- **输出发现顺序**:① 输入同目录 `<stem>.svg`(`expected_svg_path` 对 `.kuml.kts` 双扩展名剥两层:file_stem "x.kuml" → 再剥 ".kuml",对齐官方 `order-domain.kuml.kts → order-domain.svg` 行为)② stdout 中首个 `<svg` 到最后一个 `</svg>`(`extract_svg_document`,rfind 取闭合是为了嵌套 svg 时取根元素;`<?xml ...?>` 声明与前后日志噪音自动剥除,返回值保证以 `<svg` 开头)。
- **错误串**:`KUML_NOT_FOUND: ...` / `KUML_RENDER_FAILED: ...`,message 刻意避开 "not found / denied / invalid" 关键词(防前端 normalizeError 按关键词误分类,同 open_external 先例 [VERIFIED: src-tauri/src/lib.rs open_external_tests 模块注释]);渲染失败时附 exit status + stderr 末 500 字符(`tail_chars` 截尾防撑爆 IPC)。
- **无状态 + 清理**:每次调用独立探测/写盘/执行,不驻留子进程;临时目录 best-effort `remove_dir_all`,错误路径也走清理(执行段用立即求值闭包包住)。
- **命令包装**:async command 内经 `tauri::async_runtime::spawn_blocking` 执行同步主体,60s 阻塞不占死 async 运行时线程。

## 测试(render_kuml_tests,伴随实现编写)

10 个用例:候选名清单、`expected_svg_path` 双扩展/无关扩展、`kuml_needs_cmd_wrapper` 四态、`extract_svg_document`(纯文档/xml 前缀+噪音/嵌套 svg/不完整→None)、错误码前缀、`tail_chars`,以及**条件真测** `missing_cli_yields_kuml_not_found_error`(`if find_kuml().is_some() { return; }` 形式)。

条件真测真实性证据:本机 `which kuml kuml.exe kuml.cmd kuml.bat` 全部缺失(exit 4),故该测试实际执行了断言分支而非跳过。

## 验证原始输出摘录

```
$ cd src-tauri && cargo check
warning: field `health_url` is never read   ← 存量 PlantUML 代码的既有 warning,非本次引入
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 4.57s

$ cd src-tauri && cargo test
running 17 tests
test render_kuml_tests::missing_cli_yields_kuml_not_found_error ... ok
(其余 9 个 render_kuml_tests 全 ok;7 个存量测试全 ok)
test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

## 与契约的偏离

无。补充说明(非偏离):
- 真实渲染成功路径(kuml CLI 存在时的文件发现/stdout 提取/超时)因本机未安装 kuml 无法端到端验证,仅纯函数单测 + 错误路径真测;相关行为标注 [ASSUMED]:① `cmd /C` 调起 `.cmd/.bat` 在含空格路径下的引号行为(std 按 CommandLineToArgvW 规则加引号,cmd.exe 解析基本兼容,未实测);② 嵌套 `<svg>` 文档取首开末闭区间(官方单根文档不受影响)。
- 超时上限 60s、轮询 100ms 按任务卡实现,以常量 `KUML_TIMEOUT_MS` / `KUML_POLL_INTERVAL_MS` 落地。

## 关键指标

- 代码行数:+316 / -1(含 10 个测试用例)
- 测试:17/17 PASS(10 新增 + 7 存量)
