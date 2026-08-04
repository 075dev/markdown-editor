import { isTauri } from '@/services/env'
import { WEB_FALLBACK_FONTS } from '@/stores/settings'

/**
 * 字体服务：把"获取系统已安装字体"封装成统一的异步接口。
 *
 *   - Tauri 桌面：调后端 `list_system_fonts` 命令拿到全家族名，
 *     再按客户端常见关键字拆分 sans / mono 两个下拉列表
 *   - Web 模式：返回 WEB_FALLBACK_FONTS 内置常见列表
 *
 * 返回值始终是 `{ sans: string[], mono: string[] }`，去重且排序。
 */

export interface FontList {
  sans: string[]
  mono: string[]
}

/**
 * 启发式判断家族名是否为"看起来像等宽"。
 * 关键字列表与 src-tauri/src/lib.rs 里的 is_mono_family 保持一致。
 */
const MONO_HINTS = [
  'mono',
  'code',
  'consol',
  'cour',
  'menlo',
  'monaco',
  'cascadia',
  'fira',
  'hack',
  'inconsolata',
  'ibm plex mono',
  'sarasa mono',
  'liberation mono',
  'ubuntu mono',
  'pt mono',
  'roboto mono',
  'share tech mono',
  'space mono',
  'vt323',
  'go mono',
  'source code',
  'dejavu sans mono',
]

function isMonoFamily(family: string): boolean {
  const lower = family.toLowerCase()
  return MONO_HINTS.some((hint) => lower.includes(hint))
}

/** Web fallback 列表 */
function webFallbackList(): FontList {
  const sansSet = new Set<string>(WEB_FALLBACK_FONTS.sans)
  const monoSet = new Set<string>(WEB_FALLBACK_FONTS.mono)
  return {
    sans: [...sansSet].sort(),
    mono: [...monoSet].sort(),
  }
}

let cache: FontList | null = null

/**
 * 获取系统字体列表（带内存缓存，重复调用零成本）。
 * 失败时降级为 web fallback，保证 UI 始终能渲染选项。
 */
export async function listSystemFonts(): Promise<FontList> {
  if (cache) return cache
  let list: FontList
  if (isTauri()) {
    list = await tauriListSystemFonts().catch(() => webFallbackList())
  } else {
    list = webFallbackList()
  }
  cache = list ?? webFallbackList()
  return cache
}

/** 强制清缓存（设置页"刷新列表"按钮用） */
export function clearFontCache() {
  cache = null
}

interface TauriFontList {
  all: string[]
  sans: string[]
  mono: string[]
}

async function tauriListSystemFonts(): Promise<FontList> {
  const { invoke } = await import('@tauri-apps/api/core')
  const result = await invoke<TauriFontList>('list_system_fonts')

  const all = result.all ?? []
  // 系统返回的全家族名 → 客户端按关键字拆 sans / mono
  const sansSet = new Set<string>(WEB_FALLBACK_FONTS.sans)
  const monoSet = new Set<string>(WEB_FALLBACK_FONTS.mono)

  for (const family of all) {
    if (typeof family !== 'string' || !family.trim()) continue
    const trimmed = family.trim()
    if (isMonoFamily(trimmed)) {
      monoSet.add(trimmed)
    } else {
      sansSet.add(trimmed)
    }
  }

  // Web fallback 与 backend 列表都不应被丢掉（即使后端没找到也保留 fallback）
  return {
    sans: [...sansSet].sort(),
    mono: [...monoSet].sort(),
  }
}