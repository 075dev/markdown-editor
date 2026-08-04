# scripts/verify-icon.ps1
#
# 验证 EXE 资源表里的图标。Windows 任务栏图标读取链：
#   1) 窗口 WM_SETICON（运行时 SetWindowIcon）
#   2) EXE 资源表 IDI_ICON1（打包时嵌入）
#   3) 资源管理器 .ico 文件关联
#
# 这个脚本检查 EXE 内嵌的图标资源数 + 检测任务栏缓存里的图标。

param(
    [string]$ExePath = "src-tauri\target\release\markdown-editor.exe"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ExePath)) {
    Write-Host "EXE not found: $ExePath" -ForegroundColor Red
    Write-Host "Run 'pnpm tauri:build' first." -ForegroundColor Yellow
    exit 1
}

Write-Host "=== MarkDownEditor icon verification ===" -ForegroundColor Cyan
Write-Host "Target: $ExePath" -ForegroundColor Gray
Write-Host ""

# 1. EXE 资源表里的图标（PowerShell 用 [System.Reflection.Assembly] 或更直接用 dumpbin）
Write-Host "[1] EXE embedded icons:" -ForegroundColor Yellow
$dir = Split-Path $ExePath -Parent
$iconIco = Join-Path $dir "icon.ico"
if (Test-Path $iconIco) {
    $size = (Get-Item $iconIco).Length
    Write-Host "  icon.ico found: $([math]::Round($size/1KB, 1)) KB" -ForegroundColor Green
} else {
    Write-Host "  icon.ico NOT found at $iconIco" -ForegroundColor Red
}

# 2. Windows 任务栏缓存（IconCache.db）
Write-Host ""
Write-Host "[2] Windows icon cache:" -ForegroundColor Yellow
$cachePaths = @(
    "$env:LOCALAPPDATA\IconCache.db",
    "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache_*.db"
)
foreach ($p in $cachePaths) {
    if ($p -like "*\*") {
        $files = Get-ChildItem -Path $p -ErrorAction SilentlyContinue
        if ($files) {
            Write-Host "  $($p):" -ForegroundColor Gray
            foreach ($f in $files) {
                Write-Host "    $($f.Name) ($([math]::Round($f.Length/1KB, 1)) KB)" -ForegroundColor Gray
            }
        }
    } else {
        if (Test-Path $p) {
            Write-Host "  $p (exists)" -ForegroundColor Green
        } else {
            Write-Host "  $p (does not exist - explorer will create on startup)" -ForegroundColor Gray
        }
    }
}

# 3. Explorer 进程状态
Write-Host ""
Write-Host "[3] Explorer status:" -ForegroundColor Yellow
$exp = Get-Process -Name explorer -ErrorAction SilentlyContinue
if ($exp) {
    Write-Host "  explorer running: $($exp.Count) instances" -ForegroundColor Green
} else {
    Write-Host "  explorer NOT running (icons will rebuild on next login)" -ForegroundColor Yellow
}

# 4. 通知用户清理建议
Write-Host ""
Write-Host "Recommended actions if taskbar icon doesn't appear:" -ForegroundColor Cyan
Write-Host "  1. Run: powershell -File scripts/force-refresh-taskbar.ps1 -Hard"
Write-Host "  2. If still wrong: -Nuclear"
Write-Host "  3. Last resort: uninstall + reinstall the app"