#!/usr/bin/env node
// scripts/build-app-icon.mjs
//
// 把 src-tauri/app-icon.svg 转成多尺寸 PNG，再交给 `cargo tauri icon` 派生
// Windows ICO / macOS ICNS / Linux 全套图标。
//
// 输出（替换 src-tauri/icons/）：
//   icon-32.png   32x32
//   icon-64.png   64x64
//   icon-128.png  128x128
//   icon-256.png  256x256   (1x of @2x)
//   icon-512.png  512x512   (source for tauri icon command)
//   128x128.png   alias
//   128x128@2x.png  alias (=256)
//
// 用法：node scripts/build-app-icon.mjs

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SVG = resolve(ROOT, 'src-tauri/app-icon.svg')
const OUT = resolve(ROOT, 'src-tauri/icons')

const SIZES = [
  { size: 32, name: '32x32.png' },
  { size: 64, name: '64x64.png' },
  { size: 128, name: '128x128.png' },
  { size: 256, name: '128x128@2x.png' },
  { size: 512, name: 'icon-512.png' },
]

async function main() {
  await mkdir(OUT, { recursive: true })

  const svg = (await import('node:fs/promises')).readFile
  const source = sharp(SVG)

  for (const { size, name } of SIZES) {
    const out = resolve(OUT, name)
    await sharp(SVG).resize(size, size).png().toFile(out)
    console.log(`  ${name.padEnd(20)} ${size}x${size}`)
  }
  console.log('Done. Now run `pnpm dlx @tauri-apps/cli icon src-tauri/icon-512.png` to generate ICO/ICNS/StoreLogo.')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})