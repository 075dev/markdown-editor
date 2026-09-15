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
            get_plantuml_server_url,
            take_startup_open_path
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