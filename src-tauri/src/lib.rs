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
        .invoke_handler(tauri::generate_handler![
            open_diagram_window,
            list_system_fonts
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
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