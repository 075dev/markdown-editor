// Tauri 2：`get_webview_window` 由 `tauri::Manager` 提供，编译期会用到。
#[allow(unused_imports)]
use tauri::Manager;
use tauri::{WebviewUrl, WebviewWindowBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                // 仅在 dev 构建中尝试打开 DevTools；release 构建跳过避免额外依赖。
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![open_diagram_window])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// 打开一个独立的 Webview 窗口用于查看 PlantUML 图。
///
/// 前端传入：
///   - url: PlantUML 渲染服务的完整 URL（必填）
///   - title: 窗口标题（默认 "UML 图"）
///   - source: PlantUML 原始源码（用于独立窗口显示复制按钮）
///   - width / height: 窗口初始尺寸
///
/// 窗口加载的是静态 `diagram.html`（前端打包产物），URL 通过 query string 传递。
/// 静态页面通过读 `window.location.search` 解析参数，再调植物 panzoom 实例。
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

    // URL-encode 参数，避免源码里的换行 / 特殊字符破坏 query string
    let encoded_url = urlencode(&url);
    let encoded_source = urlencode(&s);
    let page = format!(
        "diagram.html?url={}&title={}&source={}",
        encoded_url,
        urlencode(&t),
        encoded_source
    );

    // 唯一标签：避免重复打开同一窗口；用户想开多个相同图就每次手动点
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

/// 极简的 URL-encode：把字符串放进 query string 安全传输。
/// 不依赖 urlencoding crate，避免新增 Cargo 依赖。
fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            // unreserved 字符：字母数字 + - _ . ~
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}