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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_diagram_window,
            list_system_fonts,
            watch_file,
            unwatch_file,
            read_file
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
#[tauri::command]
async fn open_diagram_window(
    app: tauri::AppHandle,
    url: String,
    title: Option<String>,
    source: Option<String>,
    width: Option<f64>,
    height: Option<f64>,
) -> Result<(), String> {
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

    let label = format!(
        "diagram-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    );

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
        return Err(format!("path does not exist: {}", path));
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
                // 只关心"内容变更"类型：Modify(Data(Content)) / Modify(Name(Rename))
                let interesting = matches!(
                    event.kind,
                    EventKind::Modify(ModifyKind::Data(_))
                        | EventKind::Modify(ModifyKind::Name(RenameMode::To))
                        | EventKind::Create(_)
                );
                if !interesting {
                    return;
                }
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
                    serde_json::json!({ "path": path_for_cb }),
                );
            }
            Err(_e) => {
                // 通知错误通常意味着文件被删/重命名，忽略
            }
        }
    })
    .map_err(|e| format!("failed to create watcher: {e}"))?;

    watcher
        .watch(&path_buf, RecursiveMode::NonRecursive)
        .map_err(|e| format!("failed to watch {path}: {e}"))?;

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
    std::fs::read_to_string(&path).map_err(|e| format!("read failed: {e}"))
}