/**
 * 预览区链接分类与文档跳转路径解析(add-002 T3,契约 event-flow.md
 * 「文档链接跳转约定」行为细则 1/2)。
 *
 * 纯函数模块:零依赖、不触文件系统、不用任何 DOM/Tauri API,
 * jsdom 与 Node 环境均可直接测试(宪法 C2)。
 *
 * 分类规则(协议大小写不敏感):
 *   - `#fragment`            → anchor(预览内平滑滚动)
 *   - http:// https:// mailto: → external(/ipc/open-external)
 *   - javascript: data: vbscript: → ignored(rehype-sanitize 已挡,双保险)
 *   - 其余非空 href           → document(文档间跳转,相对/工作区路径)
 *   - 空 href                 → ignored
 *
 * 路径解析约定(本编辑器桌面目标为 Windows,AGENTS.md 平台优先级):
 *   解析结果统一归一为反斜杠 `\` 分隔形式——与契约「Windows 盘符开头视为
 *   绝对路径、归一为反斜杠形式」一致;Rust read_file 在 Windows 上原生
 *   接受反斜杠路径。`.`/`..` 段消解为纯字符串算法,不触文件系统。
 */

export type PreviewLinkKind = 'anchor' | 'external' | 'document' | 'ignored'

export interface PreviewLinkClassification {
  kind: PreviewLinkKind
  /**
   * 剥离出的锚点 fragment:
   *   - anchor:decodeURIComponent 后的锚文本(中文标题的 href 会被
   *     百分号编码,T2 实测);解码失败用原串
   *   - external / document:剥离出的原始 fragment(解码容错同上);
   *     仅 document 解析链路关注,external 不使用
   *   - ignored / 无锚点:null
   */
  fragment: string | null
}

/** decodeURIComponent 失败容错(非法百分号编码时返回原串) */
function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** 在首个 `#` 处切出 body 与 fragment(markdown 链接不含转义 `#` 场景) */
function splitFragment(href: string): { body: string; fragment: string | null } {
  const hashIndex = href.indexOf('#')
  if (hashIndex === -1) return { body: href, fragment: null }
  return { body: href.slice(0, hashIndex), fragment: href.slice(hashIndex + 1) }
}

const EXTERNAL_PROTOCOL_RE = /^(?:https?:|mailto:)/i
const DANGEROUS_PROTOCOL_RE = /^(?:javascript|data|vbscript):/i
/** Windows 盘符开头(如 `C:\`、`c:/`)视为绝对路径 */
const WINDOWS_DRIVE_RE = /^[a-zA-Z]:[\\/]/

/**
 * 按契约分类预览区 `<a href>`。纯函数,不做任何 I/O。
 */
export function classifyPreviewLink(href: string): PreviewLinkClassification {
  if (href.trim() === '') {
    return { kind: 'ignored', fragment: null }
  }
  if (href.startsWith('#')) {
    return { kind: 'anchor', fragment: safeDecodeURIComponent(href.slice(1)) }
  }
  if (DANGEROUS_PROTOCOL_RE.test(href)) {
    return { kind: 'ignored', fragment: null }
  }
  if (EXTERNAL_PROTOCOL_RE.test(href)) {
    const { fragment } = splitFragment(href)
    return {
      kind: 'external',
      fragment: fragment === null ? null : safeDecodeURIComponent(fragment),
    }
  }
  const { fragment } = splitFragment(href)
  return {
    kind: 'document',
    fragment: fragment === null ? null : safeDecodeURIComponent(fragment),
  }
}

/**
 * 消解 `.`/`..` 段并把分隔符归一为 `\`(纯字符串算法,不触文件系统)。
 *   - 盘符段(`C:`)保留,`..` 跳不出盘符根
 *   - `/` 开头视为绝对(工作区根相对形式进入本函数前已拼上 rootPath)
 *   - 相对路径里跳不出基准的 `..` 原样保留(交由上层读盘失败兜底)
 */
function normalizePathSegments(input: string): string {
  const unified = input.replace(/\//g, '\\')
  const driveMatch = /^([a-zA-Z]:)([\s\S]*)$/.exec(unified)
  const drive = driveMatch === null ? '' : driveMatch[1]
  let rest = driveMatch === null ? unified : driveMatch[2]
  const isAbsolute = rest.startsWith('\\')
  if (isAbsolute) rest = rest.slice(1)

  const out: string[] = []
  for (const segment of rest.split('\\')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      if (out.length > 0) {
        out.pop()
      } else if (drive !== '' || isAbsolute) {
        // 已在根(盘符根 / 绝对根),多余 `..` 忽略
      } else {
        out.push('..')
      }
      continue
    }
    out.push(segment)
  }
  const body = out.join('\\')
  if (drive !== '') return drive + '\\' + body
  if (isAbsolute) return '\\' + body
  return body
}

/** 最终段无扩展名 → 补 `.md`(有 `?` query 的场景本编辑器不涉及) */
function ensureMarkdownExtension(path: string): string {
  const lastSegment = path.split(/[\\/]/).pop() ?? ''
  if (lastSegment === '' || lastSegment.includes('.')) return path
  return path + '.md'
}

/**
 * 解析文档跳转目标为绝对路径(行为细则 2):
 *   1. decodeURIComponent(整体,非法编码容错用原串)→ 剥离 `#fragment`
 *   2. Windows 盘符开头 → 绝对路径,归一反斜杠形式直接返回
 *   3. `/` 开头 → 相对工作区根(rootPath 缺失 → null)
 *   4. 其余 → 相对当前文档所在目录(currentPath 缺失 → null)
 *   5. 最终段无扩展名 → 补 `.md`
 *
 * 返回 null 表示无法解析(调用方负责状态栏错误提示)。
 */
export function resolveDocumentHref(
  currentPath: string | null,
  rootPath: string | null,
  href: string,
): string | null {
  const decoded = safeDecodeURIComponent(href)
  const { body } = splitFragment(decoded)
  if (body.trim() === '') return null

  if (WINDOWS_DRIVE_RE.test(body)) {
    return ensureMarkdownExtension(normalizePathSegments(body))
  }

  if (body.startsWith('/') || body.startsWith('\\')) {
    if (rootPath === null || rootPath === '') return null
    const joined =
      rootPath.replace(/[\\/]+$/, '') + '\\' + body.replace(/^[\\/]+/, '')
    return ensureMarkdownExtension(normalizePathSegments(joined))
  }

  if (currentPath === null || currentPath === '') return null
  const dirEnd = Math.max(currentPath.lastIndexOf('\\'), currentPath.lastIndexOf('/'))
  const dir = dirEnd === -1 ? '' : currentPath.slice(0, dirEnd)
  const joined = dir === '' ? body : dir + '\\' + body.replace(/^[\\/]+/, '')
  return ensureMarkdownExtension(normalizePathSegments(joined))
}
