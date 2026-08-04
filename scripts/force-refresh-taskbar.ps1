# scripts/force-refresh-taskbar.ps1
#
# Windows 任务栏图标刷新工具。Windows 会深度缓存任务栏图标（按 AppUserModelID
# 或 EXE 路径），即使应用调用 SetWindowIcon / SHChangeNotify，也不一定立刻更新。
# 跑这个脚本强制重建 explorer 任务栏图标缓存。
#
# 三种强度：
#   1) 重新启动 explorer.exe（最常见，80% 场景足够）
#   2) 删除 IconCache.db 并重启 explorer（更彻底）
#   3) 同时重建系统图标缓存（最彻底，最后手段）
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts/force-refresh-taskbar.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/force-refresh-taskbar.ps1 -Hard
#   powershell -ExecutionPolicy Bypass -File scripts/force-refresh-taskbar.ps1 -Nuclear

param(
    [switch]$Hard,
    [switch]$Nuclear
)

$ErrorActionPreference = "Stop"

Write-Host "=== MarkDownEditor taskbar icon refresh ===" -ForegroundColor Cyan
Write-Host "Mode: $(if ($Nuclear) { 'NUCLEAR' } elseif ($Hard) { 'HARD' } else { 'NORMAL' })" -ForegroundColor Yellow
Write-Host ""

# Step 1: 强制关闭 explorer
Write-Host "[1/3] Stopping explorer.exe..." -ForegroundColor Yellow
Get-Process -Name explorer -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Step 2: (可选) 删除 IconCache
if ($Hard -or $Nuclear) {
    Write-Host "[2/3] Deleting IconCache.db ..." -ForegroundColor Yellow
    $iconCache = "$env:LOCALAPPDATA\IconCache.db"
    if (Test-Path $iconCache) {
        Remove-Item -Path $iconCache -Force -ErrorAction SilentlyContinue
        Write-Host "  Removed $iconCache" -ForegroundColor Green
    } else {
        Write-Host "  $iconCache not found (skip)" -ForegroundColor Gray
    }

    # 删除 thumbnail 缓存（也持有图标）
    $thumbCache = "$env:LOCALAPPDATA\Microsoft\Windows\Explorer"
    Get-ChildItem -Path $thumbCache -Filter "iconcache_*" -ErrorAction SilentlyContinue |
        ForEach-Object { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue }
}

# Step 2: (Nuclear) 重建系统图标缓存
if ($Nuclear) {
    Write-Host "[2/3] Rebuilding system icon cache (ie4uinit.exe)..." -ForegroundColor Yellow
    $ie4uinit = "$env:SystemRoot\System32\ie4uinit.exe"
    if (Test-Path $ie4uinit) {
        & $ie4uinit -show
        Write-Host "  Done" -ForegroundColor Green
    } else {
        Write-Host "  ie4uinit.exe not found, skip" -ForegroundColor Yellow
    }
}

# Step 3: 重启 explorer
Write-Host "[3/3] Starting explorer.exe..." -ForegroundColor Yellow
Start-Process explorer.exe
Start-Sleep -Seconds 1

Write-Host ""
Write-Host "Done. Check the taskbar now." -ForegroundColor Green
Write-Host "If the icon still isn't right, fully uninstall + reinstall the app." -ForegroundColor Yellow