// Tauri 2：`get_webview_window` 由 `tauri::Manager` 提供，编译期会用到。
use tauri::Manager;
use tauri::{AppHandle, Emitter, WebviewUrl, WebviewWindowBuilder};

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use notify::event::{ModifyKind, RenameMode};
use notify::{EventKind, RecursiveMode, Watcher};
use once_cell::sync::Lazy;

#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::Shell::{SHChangeNotify, SHCNE_ASSOCCHANGED, SHCNF_IDLIST};

/// 通知 Windows 资源管理器刷新所有图标关联。
/// 调用 `SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, NULL, NULL)`，
/// 让 explorer 重新读取任务栏图标缓存。
#[cfg(target_os = "windows")]
fn refresh_windows_shell_icons() {
    unsafe {
        SHChangeNotify(
            SHCNE_ASSOCCHANGED.try_into().unwrap(),
            SHCNF_IDLIST.try_into().unwrap(),
            std::ptr::null(),
            std::ptr::null(),
        );
    }
}

/* ---------- 启动参数:系统"打开方式"传入的文档路径(bugfix-001) ---------- */

/// 待前端取走的启动文档路径。前端就绪后经 take_startup_open_path 一次性消费。
static STARTUP_OPEN_PATH: Lazy<Mutex<Option<String>>> = Lazy::new(|| Mutex::new(None));

/// 从命令行参数提取首个可打开的文档路径。
/// 规则:跳过程序名与 `-` 开头的选项;仅接受 md/markdown/mdx/txt 扩展名(大小写不敏感)。
/// 不做存在性校验 —— 文件缺失由前端打开链路(read_text 失败 → 返回 false)自然兜底,
/// 保持本函数为纯解析以便测试。
fn startup_open_path_from_args<I: Iterator<Item = String>>(args: I) -> Option<String> {
    for arg in args.skip(1) {
        if arg.starts_with('-') {
            continue;
        }
        let ext_ok = PathBuf::from(&arg)
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| matches!(e.to_ascii_lowercase().as_str(), "md" | "markdown" | "mdx" | "txt"))
            .unwrap_or(false);
        if ext_ok {
            return Some(arg);
        }
    }
    None
}

/// 前端挂载后取走启动文档路径(一次性,取走即清空,避免重复打开)。
#[tauri::command]
fn take_startup_open_path() -> Option<String> {
    STARTUP_OPEN_PATH.lock().unwrap().take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 系统"打开方式"/文件关联启动时,文档路径在 argv 里(bugfix-001)。
    // 解析后暂存,前端就绪后经 take_startup_open_path 一次性取走。
    if let Some(p) = startup_open_path_from_args(std::env::args()) {
        eprintln!("[startup-open] doc path from argv: {}", p);
        *STARTUP_OPEN_PATH.lock().unwrap() = Some(p);
    }

    tauri::Builder::default()
        // 单实例 + 暖启动 argv 转发(bugfix-002):官方插件用 OS 原生
        // mutex,不再落盘 lockfile —— 修复"退出后锁文件残留导致再也
        // 打不开";第二实例启动时其 argv 会转发到本回调(暖启动打开
        // 文档),随后第二实例自动退出。官方要求该插件注册在最前。
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // 插件 Windows 实现转发的是第二实例完整 argv(含程序名),
            // startup_open_path_from_args 内部 skip(1) 与之对应。
            if let Some(p) = startup_open_path_from_args(args.into_iter()) {
                eprintln!("[startup-open] warm-open doc path: {}", p);
                let _ = app.emit("startup-open-file", serde_json::json!({ "path": p }));
            }
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // 把应用图标显式设到主窗口上。
            // Windows 任务栏图标优先读主窗口的窗口图标（WM_SETICON），而不是
            // EXE 文件内嵌资源 —— 后者只用于资源管理器。
            // 设置后任务栏会立刻使用新图标。
            //
            // 路径解析：
            //   debug: `<tauri_root>/src-tauri/target/debug/icon.ico`
            //   release: `<tauri_root>/src-tauri/target/release/icon.ico`
            // 我们用 `tauri::utils::platform::resource_dir()` 拿应用资源目录，
            // 然后到 `icons/icon.ico`。
            if let Some(window) = app.get_webview_window("main") {
                #[cfg(any(target_os = "windows", target_os = "linux"))]
                {
                    match resolve_window_icon_path(app.handle()) {
                        Some(icon_path) => {
                            eprintln!("[icon] resolved icon path: {}", icon_path.display());
                            match tauri::image::Image::from_path(&icon_path) {
                                Ok(img) => {
                                    eprintln!(
                                        "[icon] decoded {}x{} image from {}",
                                        img.width(),
                                        img.height(),
                                        icon_path.display()
                                    );
                                    match window.set_icon(img) {
                                        Ok(()) => {
                                            eprintln!("[icon] window.set_icon OK — taskbar should now show this icon");
                                            #[cfg(target_os = "windows")]
                                            {
                                                // Windows 任务栏图标更新到下一次
                                                // explorer 重建图标缓存时生效。
                                                // 主动调用 SHChangeNotify 触发：
                                                //   SHCNE_ASSOCCHANGED = 0x08000000
                                                // 这会要求 explorer 刷新所有图标关联。
                                                refresh_windows_shell_icons();
                                                eprintln!("[icon] SHChangeNotify(SHCNE_ASSOCCHANGED) sent");
                                            }
                                        }
                                        Err(e) => {
                                            eprintln!("[icon] window.set_icon FAILED: {e}");
                                        }
                                    }
                                }
                                Err(e) => {
                                    eprintln!("[icon] failed to decode {icon_path:?}: {e}");
                                }
                            }
                        }
                        None => {
                            eprintln!("[icon] no icon.ico found in any candidate path");
                            eprintln!(
                                "[icon] searched: <EXE dir>/icon.ico, <tauri resource_dir>/icons/icon.ico, {}/icons/icon.ico",
                                env!("CARGO_MANIFEST_DIR")
                            );
                        }
                    }
                }
            }

            #[cfg(debug_assertions)]
            {
                // 仅在 dev 构建中尝试打开 DevTools；release 构建跳过避免额外依赖。
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }

            // 后台启动本地 PlantUML HTTP 服务（如果系统装了 java 且能找到 jar）。
            // 失败不报错：前端拿不到 URL 时 fallback 到 www.plantuml.com / 源码。
            let _ = ensure_plantuml_server(app.handle());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_diagram_window,
            list_system_fonts,
            watch_file,
            unwatch_file,
            read_file,
            allow_workspace_dir,
            open_external,
            get_plantuml_server_url,
            take_startup_open_path,
            render_kuml
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// 解析窗口图标所在的路径。优先级：
///   1) 与 EXE 同目录的 `icon.ico`（dev/release 都会有这个文件；
///      Tauri 2 的 `cargo tauri icon` 把它复制到 target/{profile}/）
///   2) Tauri 资源目录（bundle 之后）
///   3) 源码目录 `src-tauri/icons/icon.ico`（兜底）
fn resolve_window_icon_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    // 1) 基于 EXE 目录
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let candidate = dir.join("icon.ico");
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }
    // 2) Tauri 资源目录（用 AppHandle.path 拿，避免签名变化）
    if let Ok(dir) = app.path().resource_dir() {
        let candidate = dir.join("icons").join("icon.ico");
        if candidate.exists() {
            return Some(candidate);
        }
    }
    // 3) 源码目录（开发期）
    let src = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("icons")
        .join("icon.ico");
    if src.exists() {
        return Some(src);
    }
    None
}

/// 打开一个独立的 Webview 窗口用于查看 PlantUML 图。
///
/// 行为约定：
///   - 同一张图（按 URL 稳定哈希）只允许一个窗口。
///   - 重复打开同一张图 ⇒ 把已开窗口 focus 到前面，不创建新窗口。
///   - `windowKey` 由前端给出（默认等于 URL），便于调用方自定义 key。
#[tauri::command]
async fn open_diagram_window(
    app: tauri::AppHandle,
    url: String,
    title: Option<String>,
    source: Option<String>,
    width: Option<f64>,
    height: Option<f64>,
    window_key: Option<String>,
) -> Result<(), String> {
    use tauri::Manager;
    let w = width.unwrap_or(1024.0);
    let h = height.unwrap_or(768.0);
    let t = title.unwrap_or_else(|| "UML 图".to_string());
    let s = source.unwrap_or_default();

    let encoded_url = urlencode(&url);
    let encoded_source = urlencode(&s);
    let page = format!(
        "diagram.html?url={}&title={}&source={}",
        encoded_url,
        urlencode(&t),
        encoded_source
    );

    // 用稳定的 key 作为窗口 label —— 同一张图共用一个窗口。
    // 1) 调用方传 window_key（等于 url）→ 直接当作 label 后缀；
    // 2) 兜底：用 url 哈希（FNV-1a 64-bit）做 label。
    let key = window_key.unwrap_or_else(|| url.clone());
    let label = format!("diagram-{:x}", fnv1a_64(key.as_bytes()));

    // 已存在窗口：focus 后返回
    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.unminimize();
        let _ = existing.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(page.into()))
        .title(t)
        .inner_size(w, h)
        .min_inner_size(480.0, 320.0)
        .resizable(true)
        .maximizable(true)
        .minimizable(true)
        .build()
        .map_err(|e| format!("failed to open diagram window: {e}"))?;

    Ok(())
}

/// 简单 FNV-1a 64-bit 哈希，仅用于把任意字符串映射到稳定 label。
/// 不依赖额外 crate。
fn fnv1a_64(bytes: &[u8]) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for b in bytes {
        hash ^= *b as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

/// 返回系统已安装的全部字体家族名（去重、排序）。
///
/// system-fonts 0.1.x 的 `find_for_system_locale` 只暴露 Sans / Serif，
/// 不区分 mono。需求是"用户手动从系统字体里挑"——所以我们直接返回全家族名，
/// 由前端根据 `WEB_FALLBACK_FONTS.mono`（常见等宽关键字）做交集，
/// 把"看起来像等宽"的家族名放进 mono 下拉。
///
/// 返回结构：
///   - `all`: 全部已安装家族名（前端用这个 + mono 关键字列表判断 mono）
///   - `sans`: system-fonts `Sans` 风格预解析（Win/macOS/Linux 上字体优先级合理）
///
/// Web 模式（前端 fallback）已经覆盖了 WEB_FALLBACK_FONTS，此命令仅在 Tauri 桌面调用。
#[tauri::command]
fn list_system_fonts() -> FontList {
    use std::collections::BTreeSet;
    use system_fonts::{find_for_system_locale, FontStyle};

    let mut all: BTreeSet<String> = BTreeSet::new();

    // Sans preset：覆盖主流 UI 字体
    let (_locale, _region, sans_fonts) = find_for_system_locale(FontStyle::Sans);
    for f in sans_fonts {
        all.insert(f.family);
    }

    // Serif preset：补充中文 / 日文 / 韩文等区域字体
    let (_locale2, _region2, serif_fonts) = find_for_system_locale(FontStyle::Serif);
    for f in serif_fonts {
        all.insert(f.family);
    }

    // 也把系统上"非预设"但已安装的字体家族拉进来；
    // find_for_system_locale 内部其实已经扫了所有 fontdb，所以 all 已是最全集。

    FontList {
        all: all.into_iter().collect(),
        sans: Vec::new(),
        mono: Vec::new(),
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct FontList {
    /// 全部已安装字体家族名（前端用关键字匹配拆分 sans / mono）
    all: Vec<String>,
    /// 预解析 sans（保留字段以便未来直接用）
    #[allow(dead_code)]
    sans: Vec<String>,
    /// 预解析 mono（保留字段以便未来直接用）
    #[allow(dead_code)]
    mono: Vec<String>,
}

/// 极简 URL-encode（与 open_diagram_window 共享）。
fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

/* ---------- 文件监听（外部修改自动重载） ---------- */

/// 全局 watcher：持有所有活跃 watch handle，按路径去重。
/// Mutex + Lazy<Mutex<...>> 单例。
struct FileWatcher {
    /// notify::RecommendedWatcher 实例（持活才有事件）
    _watcher: notify::RecommendedWatcher,
    /// 当前 watcher 监听的路径（用于管理）
    _path: PathBuf,
}

static ACTIVE_WATCHER: Lazy<Mutex<Option<FileWatcher>>> = Lazy::new(|| Mutex::new(None));

/// 开始监听指定文件（如果已监听同路径则忽略）。
/// 收到事件后通过 Tauri `emit("file-external-change", { path })` 推给前端。
/// 节流：连续事件去重到 1 秒一次。
#[tauri::command]
async fn watch_file(app: AppHandle, path: String) -> Result<(), String> {
    use std::collections::HashMap;
    use std::sync::Mutex as StdMutex;
    use std::time::Instant;

    // 简单 per-path 节流：同一路径在 1s 内的多次事件只发一次。
    static LAST_FIRE: Lazy<StdMutex<HashMap<String, Instant>>> =
        Lazy::new(|| StdMutex::new(HashMap::new()));

    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(format!("FILE_NOT_FOUND: path does not exist: {}", path));
    }

    // 已经在监听同路径就跳过
    {
        let guard = ACTIVE_WATCHER.lock().unwrap();
        if let Some(w) = guard.as_ref() {
            if w._path == path_buf {
                return Ok(());
            }
        }
    }

    let app_for_cb = app.clone();
    let path_for_cb = path.clone();

    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        match res {
            Ok(event) => {
                // 事件分类：Remove 类 → removed，其余关注类型 → modified。
                // 关注类型：Modify(Data) / Modify(Name(Rename To)) / Create / Remove。
                let kind = match event.kind {
                    EventKind::Remove(_) => "removed",
                    EventKind::Modify(ModifyKind::Data(_))
                        | EventKind::Modify(ModifyKind::Name(RenameMode::To))
                        | EventKind::Create(_) => "modified",
                    _ => return,
                };
                // 1s 节流：同路径 1s 内的多次事件只 emit 一次
                let now = Instant::now();
                let mut last = LAST_FIRE.lock().unwrap();
                if let Some(prev) = last.get(&path_for_cb) {
                    if now.duration_since(*prev) < Duration::from_millis(1000) {
                        return;
                    }
                }
                last.insert(path_for_cb.clone(), now);

                // emit 给前端；前端监听 file-external-change 事件
                let _ = app_for_cb.emit(
                    "file-external-change",
                    serde_json::json!({ "path": path_for_cb, "kind": kind }),
                );
            }
            Err(_e) => {
                // 通知错误通常意味着文件被删/重命名，忽略
            }
        }
    })
    .map_err(|e| format!("WATCH_FAILED: failed to create watcher: {e}"))?;

    watcher
        .watch(&path_buf, RecursiveMode::NonRecursive)
        .map_err(|e| format!("WATCH_FAILED: failed to watch {path}: {e}"))?;

    let mut guard = ACTIVE_WATCHER.lock().unwrap();
    *guard = Some(FileWatcher {
        _watcher: watcher,
        _path: path_buf,
    });
    Ok(())
}

/// 停止监听（关闭当前 watcher）。前端在 active tab 切走时可调用。
#[tauri::command]
fn unwatch_file() {
    let mut guard = ACTIVE_WATCHER.lock().unwrap();
    *guard = None;
}

/// 重新读取文件内容（用于外部修改事件触发后的实际重载）。
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("FILE_READ_FAILED: read failed: {e}"))
}

/* ---------- 工作区 fs scope 运行时授权（bugfix-004） ---------- */

/// 把用户选定的路径加入 plugin-fs 的运行时白名单。
///
/// 目录(bugfix-004):递归放行子目录。capabilities 的 fs:scope 只静态放行
/// $HOME/$DOCUMENT/$DESKTOP/$DOWNLOAD 四个固定位置;对话框可选择的任意位置
/// 工作区(如 D:\)在 plugin-fs readDir 时被整体 forbidden——自定义 command
/// 的 read_file 不走 fs:scope(打开单文件一直正常),唯独文件树(含子目录
/// 中的 MD 文件)索引失败,表现为「打开目录后无法索引子目录中的 MD 文件」。
///
/// 单文件(bugfix-005):文件关联/暖启动/链接跳转经 openFileFromPath 打开的
/// 文件,未经对话框授权(plugin-dialog 选定后才自动 allow_file)也未经工作区
/// 放行,读盘正常但保存链路 plugin-fs writeTextFile 被 forbidden——表现为
/// 「文件能打开但无法保存」。精确放行该文件,不扩大到父目录。
#[tauri::command]
fn allow_workspace_dir(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_fs::FsExt;
    let target = std::path::Path::new(&path);
    let result = if target.is_file() {
        app.fs_scope().allow_file(target)
    } else {
        app.fs_scope().allow_directory(target, true)
    };
    result.map_err(|e| format!("INTERNAL_ERROR: allow fs scope failed: {e}"))
}

/* ---------- 外部链接打开（add-002，契约 POST /ipc/open-external） ---------- */

/// 外部链接目标协议白名单校验。
/// 仅放行 `http:` / `https:` / `mailto:` 前缀（大小写不敏感），
/// 其余（file:、javascript:、data:、cmd 等）一律拒绝——绝不把白名单外的
/// 字符串传递给系统 shell。
/// 纯函数：无 IO，便于单元测试（见 open_external_tests）。
fn validate_external_target(target: &str) -> Result<(), &'static str> {
    let lower = target.to_ascii_lowercase();
    if lower.starts_with("http:") || lower.starts_with("https:") || lower.starts_with("mailto:") {
        return Ok(());
    }
    Err("only http/https/mailto protocols are allowed")
}

/// 用系统默认程序打开外部链接。
/// 白名单不过 → Err("UNSUPPORTED_PROTOCOL: ...")；
/// 系统默认程序调用失败 → Err("OPEN_EXTERNAL_FAILED: ...")（"CODE: message" 前缀，同 read_file 先例）。
#[tauri::command]
async fn open_external(target: String) -> Result<(), String> {
    if let Err(reason) = validate_external_target(&target) {
        return Err(format!("UNSUPPORTED_PROTOCOL: {reason}: {target}"));
    }
    open::that(&target)
        .map_err(|e| format!("OPEN_EXTERNAL_FAILED: failed to open external target: {e}"))
}

/* ---------- 本地 PlantUML 服务 ---------- */

use std::sync::Arc;

/// 默认本地 PlantUML 服务的端口。PlantUML 默认 8080，但 Tauri WebView CSP
/// 对 8080 加上资源占用上的潜在冲突，我们换一个非常规端口避免冲突。
const PLANTUML_PORT: u16 = 18080;

/// Java 探测候选名（PATH 之外再加一些 Windows 上常见的路径）。
const JAVA_CANDIDATES: &[&str] = &["java", "java.exe"];

/// 本地 PlantUML 子进程句柄。Rust 进程退出时自动 drop。
static PLANTUML_CHILD: Lazy<Arc<Mutex<Option<PlantumlChild>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));

struct PlantumlChild {
    /// 进程对象 —— 持有句柄直到 drop 才会被系统回收。
    _child: std::process::Child,
    /// 健康探测 URL —— 前端用这个去拉一次 root 验证服务在跑。
    health_url: String,
    /// 拼图 URL —— PlantUML 服务器的标准端点前缀。
    diagram_base: String,
}

/// 启动本地 PlantUML 服务（如果 java 可用 + jar 找得到）。
/// 不返回 Err —— 失败时静默记录 stderr，前端拿不到 URL 走 fallback。
fn ensure_plantuml_server(app: &tauri::AppHandle) -> Result<(), String> {
    // 1. 找 java
    let java_path = find_java().ok_or_else(|| "java not found".to_string())?;
    // 2. 找 jar
    let jar_path = resolve_jar_path(app).ok_or_else(|| "plantuml.jar not found".to_string())?;
    // 3. 端口是否已被占用？已被占 → 也算 OK，假设是另一个进程起的 PlantUML
    let url_base = format!("http://127.0.0.1:{}", PLANTUML_PORT);
    if quick_probe(&format!("{}/", url_base)).is_ok() {
        let mut guard = PLANTUML_CHILD.lock().unwrap();
        *guard = Some(PlantumlChild {
            _child: spawn_no_op_handle(),
            health_url: format!("{}/", url_base),
            diagram_base: format!("{}/plantuml/svg/", url_base),
        });
        eprintln!("[plantuml] reusing existing service at {}", url_base);
        return Ok(());
    }
    // 4. spawn java -jar
    let child = std::process::Command::new(&java_path)
        .args([
            "-Djava.awt.headless=true",
            "-jar",
        ])
        .arg(&jar_path)
        .args([
            "-httpport:18080",
            "-charset",
            "UTF-8",
        ])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("failed to spawn java: {e}"))?;
    let mut guard = PLANTUML_CHILD.lock().unwrap();
    *guard = Some(PlantumlChild {
        _child: child,
        health_url: format!("{}/", url_base),
        diagram_base: format!("{}/plantuml/svg/", url_base),
    });
    eprintln!("[plantuml] launched local server at {}", url_base);
    Ok(())
}

/// 探测 PATH 与常见 Windows 安装目录里的 java。
fn find_java() -> Option<PathBuf> {
    use std::env;
    if let Some(java_home) = env::var_os("JAVA_HOME") {
        let java_home = PathBuf::from(java_home);
        let p = java_home.join("bin").join("java.exe");
        if p.exists() {
            return Some(p);
        }
        let p = java_home.join("bin").join("java");
        if p.exists() {
            return Some(p);
        }
    }
    for cand in JAVA_CANDIDATES {
        if let Ok(p) = which_first(cand) {
            return Some(p);
        }
    }
    None
}

/// 简化版 `which`：在 PATH 目录下逐个拼接测试。
fn which_first(cmd: &str) -> Result<PathBuf, ()> {
    let path_var = std::env::var_os("PATH").ok_or(())?;
    for entry in std::env::split_paths(&path_var) {
        let candidate = entry.join(cmd);
        if candidate.is_file() {
            return Ok(candidate);
        }
        let with_ext = entry.join(format!("{}.exe", cmd));
        if with_ext.is_file() {
            return Ok(with_ext);
        }
    }
    Err(())
}

/// 解析 jar 的真实路径。优先级：
///   1) 与 EXE 同目录的 `plantuml.jar`
///   2) Tauri 资源目录 `plantuml.jar`
///   3) 源码目录 `src-tauri/resources/plantuml.jar`（开发期）
fn resolve_jar_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let p = dir.join("plantuml.jar");
            if p.exists() {
                return Some(p);
            }
        }
    }
    if let Ok(dir) = app.path().resource_dir() {
        let p = dir.join("plantuml.jar");
        if p.exists() {
            return Some(p);
        }
        let p = dir.join("_up_").join("plantuml.jar");
        if p.exists() {
            return Some(p);
        }
    }
    let src = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("plantuml.jar");
    if src.exists() {
        return Some(src);
    }
    None
}

/// 探测一个 HTTP URL 是否响应 —— 不要求 200，仅要求连接成功 + 拿到响应。
fn quick_probe(url: &str) -> Result<(), String> {
    // 用 std::net::TcpStream 简单 connect，避免引入额外 HTTP client。
    let url = url.trim_start_matches("http://").trim_start_matches("https://");
    let (host_port, _path) = url.split_once('/').unwrap_or((url, ""));
    let (host, _port) = if let Some(idx) = host_port.rfind(':') {
        (&host_port[..idx], host_port[idx + 1..].parse::<u16>().unwrap_or(80))
    } else {
        (host_port, 80)
    };
    let _ = std::net::TcpStream::connect_timeout(
        &std::net::ToSocketAddrs::to_socket_addrs(&host).ok().and_then(|mut a| a.next()).ok_or("no addr")?,
        std::time::Duration::from_millis(500),
    )
    .map_err(|e| format!("probe failed: {e}"))?;
    Ok(())
}

/// 占位：复用现有进程时不需要 child。
fn spawn_no_op_handle() -> std::process::Child {
    std::process::Command::new(std::env::current_exe().unwrap_or_else(|_| PathBuf::from("/bin/true")))
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .expect("failed to spawn placeholder handle")
}

/// 前端调用这个拿本地 PlantUML 的 base URL。
/// 返回 Option<String> —— 拿不到时前端 fallback。
#[tauri::command]
fn get_plantuml_server_url() -> Option<String> {
    let guard = PLANTUML_CHILD.lock().unwrap();
    guard.as_ref().map(|c| c.diagram_base.clone())
}

/* ---------- kUML 渲染（add-005，invoke('render_kuml', { source }) → { svg } | "CODE: message"） ---------- */

/// kUML CLI 探测候选名。`.cmd` / `.bat` 批处理在 Windows 上不能被
/// CreateProcess 直接执行，命中后需经 `cmd /C` 调起（见 kuml_needs_cmd_wrapper）。
const KUML_CANDIDATES: &[&str] = &["kuml", "kuml.exe", "kuml.cmd", "kuml.bat"];

/// 渲染超时上限。JVM + Kotlin 脚本冷启动约 2-5s，60s 已是极端余量。
const KUML_TIMEOUT_MS: u64 = 60_000;
/// 子进程退出轮询间隔。
const KUML_POLL_INTERVAL_MS: u64 = 100;

/// 错误串统一 "CODE: message" 前缀（同 read_file / open_external 先例）。
/// message 文案刻意避开 "not found / denied / invalid" 等会被前端
/// normalizeError 按关键词误分类的词 —— 分类职责由 CODE 承担。
fn kuml_not_found(msg: impl std::fmt::Display) -> String {
    format!("KUML_NOT_FOUND: {msg}")
}

fn kuml_render_failed(msg: impl std::fmt::Display) -> String {
    format!("KUML_RENDER_FAILED: {msg}")
}

/// 探测 PATH 中的 kuml CLI（候选名见 KUML_CANDIDATES）。
/// 复用 which_first（逐个 PATH 目录试裸名 + .exe）；.cmd/.bat 按字面名命中。
fn find_kuml() -> Option<PathBuf> {
    for name in KUML_CANDIDATES {
        if let Ok(path) = which_first(name) {
            return Some(path);
        }
    }
    None
}

/// `.cmd` / `.bat` 批处理需经 `cmd /C` 调起，其余（exe / 无扩展名）直接执行。
fn kuml_needs_cmd_wrapper(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("cmd") || e.eq_ignore_ascii_case("bat"))
        .unwrap_or(false)
}

/// 由输入路径推断官方 SVG 输出路径。
/// 官方行为：`kuml render order-domain.kuml.kts --format svg` 产出同目录
/// `order-domain.svg`。注意 `.kuml.kts` 双扩展名的 file_stem 是
/// "order-domain.kuml"，需再剥一层 ".kuml" 才是真正的图名。
fn expected_svg_path(input: &Path) -> PathBuf {
    let stem = input
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");
    let stem = stem.strip_suffix(".kuml").unwrap_or(stem);
    input.with_file_name(format!("{stem}.svg"))
}

/// 从任意文本（stdout / SVG 文件内容）中提取完整 SVG 文档。
/// 取首个 `<svg` 到最后一个 `</svg>`（含）：容忍 `<?xml ...?>` 声明前缀与
/// 前后日志噪音；用 rfind 是为了嵌套 `<svg>` 时仍取到根元素的闭合标签。
/// 返回值保证以 `<svg` 开头（契约：完整 SVG 文档，xml 声明剥除）。
fn extract_svg_document(raw: &str) -> Option<String> {
    const OPEN: &str = "<svg";
    const CLOSE: &str = "</svg>";
    let start = raw.find(OPEN)?;
    let end = raw[start..].rfind(CLOSE)? + start + CLOSE.len();
    Some(raw[start..end].to_string())
}

/// 诊断信息截尾：stderr 过长时不撑爆 IPC 通道。
fn tail_chars(s: &str, max: usize) -> String {
    let count = s.chars().count();
    if count <= max {
        return s.to_string();
    }
    s.chars().skip(count - max).collect()
}

/// 组装 kuml 子进程命令：stdout/stderr 全部 piped 捕获；Windows 下加
/// CREATE_NO_WINDOW（0x08000000），避免渲染时闪出控制台窗口。
fn build_kuml_command(kuml_path: &Path, args: &[String]) -> std::process::Command {
    let mut command = if kuml_needs_cmd_wrapper(kuml_path) {
        let mut c = std::process::Command::new("cmd");
        c.arg("/C").arg(kuml_path);
        c
    } else {
        std::process::Command::new(kuml_path)
    };
    command.args(args);
    command.stdout(std::process::Stdio::piped());
    command.stderr(std::process::Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

/// 把子进程管道读到字符串（容错非 UTF-8，lossy）。
/// 必须在独立线程里读：若等子进程退出后再读，大量输出会把管道写满、
/// 子进程卡在 write 上而我们卡在 try_wait —— 双方互等死锁。
fn read_pipe_to_string<R: std::io::Read + Send + 'static>(mut pipe: R) -> String {
    let mut buf = Vec::new();
    let _ = pipe.read_to_end(&mut buf);
    String::from_utf8_lossy(&buf).into_owned()
}

/// kUML 渲染同步主体。无状态：每次调用独立探测、写盘、执行、清理，
/// 不驻留任何子进程/线程（每次冷启动，前端负责按源码哈希缓存）。
fn run_kuml_render(source: &str) -> Result<String, String> {
    // 1. 探测 CLI —— 不在 PATH 直接短路，不做任何 IO。
    let kuml_path = find_kuml()
        .ok_or_else(|| kuml_not_found("kuml CLI is missing from PATH (install: choco install kuml)"))?;
    eprintln!("[kuml] cli: {}", kuml_path.display());

    // 2. 随机临时目录 + 写入 <名>.kuml.kts（pid + 纳秒时间戳，并发调用不碰撞）。
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let temp_dir =
        std::env::temp_dir().join(format!("markdown-editor-kuml-{}-{}", std::process::id(), nanos));
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| kuml_render_failed(format!("failed to create temp dir: {e}")))?;
    let input_path = temp_dir.join(format!("diagram-{nanos}.kuml.kts"));
    std::fs::write(&input_path, source)
        .map_err(|e| kuml_render_failed(format!("failed to write input file: {e}")))?;
    eprintln!("[kuml] input: {}", input_path.display());

    // 3+4. 执行 `kuml render <input> --format svg` + 输出发现。
    // 闭包包住错误路径，保证任何提前返回都会走到底部的清理。
    let result = (|| -> Result<String, String> {
        let args = vec![
            "render".to_string(),
            input_path.to_string_lossy().into_owned(),
            "--format".to_string(),
            "svg".to_string(),
        ];
        let mut child = build_kuml_command(&kuml_path, &args)
            .spawn()
            .map_err(|e| kuml_render_failed(format!("failed to spawn kuml: {e}")))?;

        let stdout_pipe = child.stdout.take();
        let stderr_pipe = child.stderr.take();
        let stdout_reader =
            std::thread::spawn(move || stdout_pipe.map(read_pipe_to_string).unwrap_or_default());
        let stderr_reader =
            std::thread::spawn(move || stderr_pipe.map(read_pipe_to_string).unwrap_or_default());

        // 超时：spawn 后轮询 try_wait，到 60s 上限 kill 并回收。
        let started = std::time::Instant::now();
        let status = loop {
            match child.try_wait() {
                Ok(Some(status)) => break status,
                Ok(None) => {
                    if started.elapsed() >= Duration::from_millis(KUML_TIMEOUT_MS) {
                        let _ = child.kill();
                        let _ = child.wait(); // 回收僵尸进程，避免句柄泄漏
                        return Err(kuml_render_failed(format!(
                            "render timed out after {}s (process killed)",
                            KUML_TIMEOUT_MS / 1000
                        )));
                    }
                    std::thread::sleep(Duration::from_millis(KUML_POLL_INTERVAL_MS));
                }
                Err(e) => {
                    let _ = child.kill();
                    return Err(kuml_render_failed(format!("wait on kuml failed: {e}")));
                }
            }
        };
        let stdout_text = stdout_reader.join().unwrap_or_default();
        let stderr_text = stderr_reader.join().unwrap_or_default();
        eprintln!(
            "[kuml] exit: {status}, stdout {}B, stderr {}B",
            stdout_text.len(),
            stderr_text.len()
        );

        // 输出发现顺序：① 输入同目录 <stem>.svg（官方行为）
        //               ② stdout 中从 <svg 起的完整文档（剥掉 xml 声明）
        let expected_svg = expected_svg_path(&input_path);
        let svg = std::fs::read_to_string(&expected_svg)
            .ok()
            .and_then(|text| extract_svg_document(&text))
            .or_else(|| extract_svg_document(&stdout_text));

        svg.ok_or_else(|| {
            kuml_render_failed(format!(
                "no SVG produced (exit: {status}); stderr: {}",
                tail_chars(stderr_text.trim(), 500)
            ))
        })
    })();

    // 5. 临时目录 best-effort 清理（失败不报错）。
    let _ = std::fs::remove_dir_all(&temp_dir);

    result
}

/// 渲染 kUML 源码为 SVG。前端：`invoke('render_kuml', { source })`。
/// 成功 `Ok({ svg })` —— 以 `<svg` 开头的完整 SVG 文档；
/// 失败 `Err("CODE: message")`：
///   - KUML_NOT_FOUND：kuml CLI 不在 PATH
///   - KUML_RENDER_FAILED：脚本错误 / 找不到输出 / 超时（上限 60s）
/// async + spawn_blocking：渲染最长可阻塞 60s，不占死 async 运行时线程。
#[tauri::command]
async fn render_kuml(source: String) -> Result<KumlRenderOk, String> {
    let joined = tauri::async_runtime::spawn_blocking(move || run_kuml_render(&source)).await;
    let svg =
        joined.map_err(|e| kuml_render_failed(format!("render task failed to join: {e}")))??;
    Ok(KumlRenderOk { svg })
}

#[derive(serde::Serialize)]
struct KumlRenderOk {
    svg: String,
}

#[cfg(test)]
mod startup_open_tests {
    // 复现(bugfix-001):系统"打开方式"传入的文档路径当前无人消费。
    // 以下测试先于实现编写,当前应编译失败(函数不存在)——即复现证据。
    use super::startup_open_path_from_args;

    fn args<'a>(list: &'a [&'a str]) -> impl Iterator<Item = String> + 'a {
        std::iter::once("markdown-editor.exe".to_string())
            .chain(list.iter().map(|s| s.to_string()))
    }

    #[test]
    fn extracts_supported_doc_path() {
        assert_eq!(
            startup_open_path_from_args(args(&["D:\\notes\\demo.md"])),
            Some("D:\\notes\\demo.md".to_string())
        );
    }

    #[test]
    fn returns_none_without_doc_args() {
        assert_eq!(startup_open_path_from_args(args(&[])), None);
        assert_eq!(startup_open_path_from_args(args(&["--flag"])), None);
        assert_eq!(startup_open_path_from_args(args(&["readme.xyz"])), None);
    }

    #[test]
    fn is_case_insensitive_on_extension() {
        assert_eq!(
            startup_open_path_from_args(args(&["D:\\notes\\DEMO.MD"])),
            Some("D:\\notes\\DEMO.MD".to_string())
        );
    }
}

#[cfg(test)]
mod open_external_tests {
    // add-002 T1:外部链接打开的协议白名单校验。
    // open_external 命令本体依赖系统 shell,单测覆盖纯函数 validate_external_target;
    // 错误文案("CODE: message")在命令内拼接,避开前端 normalizeError 的
    // 模式匹配关键词(not found / denied / invalid 等)防误分类。
    use super::validate_external_target;

    #[test]
    fn allows_whitelisted_protocols_case_insensitive() {
        assert!(validate_external_target("https://example.com/doc").is_ok());
        assert!(validate_external_target("http://example.com").is_ok());
        assert!(validate_external_target("HTTPS://EXAMPLE.COM/PATH").is_ok());
        assert!(validate_external_target("Http://mixed-case.example").is_ok());
        assert!(validate_external_target("mailto:someone@example.com").is_ok());
        assert!(validate_external_target("MailTo:Someone@Example.com").is_ok());
    }

    #[test]
    fn rejects_dangerous_protocols() {
        for bad in [
            "file:///etc/passwd",
            "FILE://C:/Windows/system32",
            "javascript:alert(1)",
            "JAVASCRIPT:void(0)",
            "data:text/html,<script>alert(1)</script>",
            "DATA:text/plain,hello",
            "cmd /c calc",
            "cmd.exe /c start http://evil.example",
            "ftp://example.com/file",
            "vbscript:msgbox",
        ] {
            assert!(
                validate_external_target(bad).is_err(),
                "should reject: {bad}"
            );
        }
    }

    #[test]
    fn rejects_bare_string_without_protocol() {
        assert!(validate_external_target("").is_err());
        assert!(validate_external_target("example.com").is_err());
        assert!(validate_external_target("www.example.com/path").is_err());
        assert!(validate_external_target("/local/path/file.md").is_err());
    }
}

#[cfg(test)]
mod render_kuml_tests {
    // add-005 W1:render_kuml 的纯逻辑单测,伴随实现编写。
    // 本机(以及大多数用户机器)未安装 kuml CLI,真实渲染路径无法单测;
    // 唯一可条件真测的分支是 find_kuml() == None → KUML_NOT_FOUND,
    // 用 `if find_kuml().is_some() { return; }` 形式保证装了 kuml 的机器不翻车。
    use super::*;

    #[test]
    fn candidates_cover_exe_cmd_bat_variants() {
        assert_eq!(
            KUML_CANDIDATES.to_vec(),
            vec!["kuml", "kuml.exe", "kuml.cmd", "kuml.bat"]
        );
    }

    #[test]
    fn expected_svg_strips_double_kuml_kts_extension() {
        let input = Path::new("tmp").join("diagram-123.kuml.kts");
        assert_eq!(
            expected_svg_path(&input),
            Path::new("tmp").join("diagram-123.svg")
        );
    }

    #[test]
    fn expected_svg_keeps_unrelated_stem_as_is() {
        let input = Path::new("tmp").join("foo.txt");
        assert_eq!(expected_svg_path(&input), Path::new("tmp").join("foo.svg"));
    }

    #[test]
    fn cmd_and_bat_need_wrapper_exe_does_not() {
        assert!(kuml_needs_cmd_wrapper(Path::new("tools/kuml.cmd")));
        assert!(kuml_needs_cmd_wrapper(Path::new("tools/KUML.BAT")));
        assert!(!kuml_needs_cmd_wrapper(Path::new("tools/kuml.exe")));
        assert!(!kuml_needs_cmd_wrapper(Path::new("tools/kuml")));
    }

    #[test]
    fn extract_svg_from_plain_document() {
        let raw = "<svg xmlns=\"http://www.w3.org/2000/svg\"><g/></svg>";
        assert_eq!(extract_svg_document(raw).as_deref(), Some(raw));
    }

    #[test]
    fn extract_svg_strips_xml_declaration_and_noise() {
        let raw = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
                   [kuml] rendering order-domain...\n\
                   <svg width=\"10\"><g>hi</g></svg>\n\
                   [done]";
        let svg = extract_svg_document(raw).expect("should extract svg document");
        assert!(svg.starts_with("<svg"), "got: {svg}");
        assert!(svg.ends_with("</svg>"), "got: {svg}");
    }

    #[test]
    fn extract_svg_keeps_outer_span_for_nested_svg() {
        let raw = "<svg><desc>outer</desc><svg>inner</svg></svg>";
        assert_eq!(extract_svg_document(raw).as_deref(), Some(raw));
    }

    #[test]
    fn extract_svg_returns_none_without_complete_document() {
        assert_eq!(extract_svg_document("no output at all"), None);
        assert_eq!(extract_svg_document("<svg>unclosed"), None);
        assert_eq!(extract_svg_document(""), None);
    }

    #[test]
    fn error_constructors_use_code_prefix() {
        assert_eq!(kuml_not_found("x"), "KUML_NOT_FOUND: x");
        assert_eq!(kuml_render_failed("y"), "KUML_RENDER_FAILED: y");
    }

    #[test]
    fn tail_chars_limits_output() {
        assert_eq!(tail_chars("abcdef", 10), "abcdef");
        assert_eq!(tail_chars("abcdef", 2), "ef");
    }

    #[test]
    fn missing_cli_yields_kuml_not_found_error() {
        if find_kuml().is_some() {
            // 装了 kuml 的机器:探测命中,NOT_FOUND 分支不适用,跳过。
            return;
        }
        let err = run_kuml_render("A -> B").unwrap_err();
        assert!(
            err.starts_with("KUML_NOT_FOUND: "),
            "unexpected error: {err}"
        );
    }
}
