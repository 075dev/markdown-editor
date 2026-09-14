/**
 * 统一错误结构(契约 openapi.yaml /components/schemas/Error 的前端态)。
 *
 * 纯函数模块:不依赖任何 Tauri API,可在 Web / jsdom 环境直接使用
 * (宪法 C2:无系统能力调用,无需降级分支)。
 *
 * Rust 侧(lib.rs read_file / watch_file)返回 `"CODE: message"` 前缀格式;
 * plugin-fs / plugin-dialog 抛错为裸字符串或 Error 对象——
 * normalizeError 统一规范化为 QlError。
 */

export type QlErrorCode =
  | 'FILE_NOT_FOUND'
  | 'FILE_READ_FAILED'
  | 'FILE_WRITE_FAILED'
  | 'PATH_INVALID'
  | 'WATCH_FAILED'
  | 'WINDOW_OPEN_FAILED'
  | 'INTERNAL_ERROR'

/** 契约 Error schema 的最小前端态(details 字段骨架期不携带) */
export interface QlError {
  code: QlErrorCode
  message: string
}

/**
 * 识别 Rust 侧 `"CODE: message"` 前缀。
 * 注意:前缀必须是完整 code(避免把 "FILE_NOT_FOUND_LIKE" 这类误判),
 * message 部分允许跨行。
 */
const CODE_PREFIX_RE =
  /^(FILE_NOT_FOUND|FILE_READ_FAILED|FILE_WRITE_FAILED|PATH_INVALID|WATCH_FAILED|WINDOW_OPEN_FAILED|INTERNAL_ERROR):[ \t]?([\s\S]*)$/

/** 从任意 thrown 值里提取可读 message(保留原始文本,不改写) */
function rawMessage(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw instanceof Error) return raw.message
  if (typeof raw === 'object' && raw !== null) {
    const msg = (raw as { message?: unknown }).message
    if (typeof msg === 'string' && msg) return msg
    return JSON.stringify(raw)
  }
  return String(raw)
}

/**
 * 把 Rust invoke 的 Err(String) 与 plugin-fs 抛错规范化为 QlError。
 *
 * 骨架版策略(填充阶段可替换为结构化 Err 对象):
 *   1. "CODE: message" 前缀 → 直接映射(最可信)
 *   2. 字符串模式匹配:含 "not found"/"不存在" → FILE_NOT_FOUND;
 *      含 "denied"/"readonly"/"占用" → FILE_WRITE_FAILED;
 *      含 "invalid"/"非法" → PATH_INVALID
 *   3. 兜底 INTERNAL_ERROR
 * 原始 message 始终保留(前缀命中时去除前缀本身)。
 */
export function normalizeError(raw: unknown): QlError {
  const message = rawMessage(raw)

  const prefixed = CODE_PREFIX_RE.exec(message)
  if (prefixed) {
    return { code: prefixed[1] as QlErrorCode, message: prefixed[2] }
  }
  if (/not found|不存在/i.test(message)) {
    return { code: 'FILE_NOT_FOUND', message }
  }
  if (/denied|readonly|占用/i.test(message)) {
    return { code: 'FILE_WRITE_FAILED', message }
  }
  if (/invalid|非法/i.test(message)) {
    return { code: 'PATH_INVALID', message }
  }
  return { code: 'INTERNAL_ERROR', message }
}
