#!/usr/bin/env node
// scripts/with-rust.mjs
//
// 让 npm 子进程能稳定找到 cargo / rustc，而不必依赖 ~/.bashrc 被 source。
// 覆盖范围：常见 Rust 工具链安装位置（含 rustup 默认路径）。
//
// 用法：node scripts/with-rust.mjs <command> [args...]

import { spawn } from 'node:child_process'
import process from 'node:process'
import { existsSync } from 'node:fs'
import { join, delimiter } from 'node:path'
import { homedir } from 'node:os'

const RUST_CANDIDATES = [
  join(homedir(), '.cargo', 'bin'),
  // Windows 上 rustup 偶发将 cargo 放在这里
  'C:\\Program Files\\Rust\\bin',
  'C:\\ProgramData\\chocolatey\\bin',
  // Linux / macOS 常见位置
  '/usr/local/cargo/bin',
  '/opt/homebrew/bin',
  '/usr/local/bin',
]

function findRustBin() {
  for (const dir of RUST_CANDIDATES) {
    if (!existsSync(dir)) continue
    const exe = process.platform === 'win32' ? 'cargo.exe' : 'cargo'
    if (existsSync(join(dir, exe))) return dir
  }
  return null
}

const existingPath = process.env.PATH || process.env.Path || ''
const pathSep = process.platform === 'win32' ? ';' : ':'
const pathKey = process.platform === 'win32' ? 'Path' : 'PATH'

const rustBin = findRustBin()
if (rustBin && !existingPath.split(pathSep).includes(rustBin)) {
  // 同时注入 PATH（小写）和 Path（Windows 大小写敏感）
  process.env[pathKey] = `${rustBin}${pathSep}${existingPath}`
  process.env.PATH = process.env[pathKey]
  console.log(`[with-rust] injected ${rustBin} into ${pathKey}`)
} else if (rustBin) {
  console.log(`[with-rust] ${rustBin} already on ${pathKey}`)
} else {
  console.warn('[with-rust] no cargo found in candidate paths; proceeding anyway')
}

const [, , cmd, ...args] = process.argv
if (!cmd) {
  console.error('Usage: node scripts/with-rust.mjs <command> [args...]')
  process.exit(2)
}

const isWindows = process.platform === 'win32'

/**
 * 在 Windows 上，未知扩展名的命令（如 `pnpm`、`tauri`）实际是 .cmd 批处理，
 * Node 的 spawn 必须显式加上 .cmd 或者走 shell。
 * 这里统一加上 .cmd 扩展名（如果文件存在），避开 shell 转义陷阱。
 */
function resolveWindowsCommand(name) {
  if (!isWindows) return name
  const pathSep = ';'
  const candidates = (process.env.Path || '').split(pathSep)
  for (const dir of candidates) {
    if (!dir) continue
    const withCmd = join(dir, `${name}.cmd`)
    const withExe = join(dir, `${name}.exe`)
    if (existsSync(withCmd)) return withCmd
    if (existsSync(withExe)) return withExe
  }
  return name
}

const resolvedCmd = resolveWindowsCommand(cmd)

// Windows 上必须 shell: true 才能调用 .cmd；非 Windows 直接 exec 即可
const spawnOpts = isWindows
  ? { stdio: 'inherit', env: process.env, shell: true, windowsHide: true }
  : { stdio: 'inherit', env: process.env }

// 抑制 DEP0190：shell:true 下参数拼接的弃用提示
process.noDeprecation = true

const child = spawn(resolvedCmd, args, spawnOpts)

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})

child.on('error', (err) => {
  console.error(`[with-rust] failed to spawn ${cmd}:`, err.message)
  process.exit(1)
})