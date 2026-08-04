import type { Plugin } from 'unified'
import rehypeShiki from '@shikijs/rehype'

/**
 * 通用代码块语法高亮：基于 Shiki + 双主题（github-light + github-dark）。
 *
 * 主题通过 CSS 变量切换：
 *   <span style="--shiki-light:#xxx;--shiki-dark:#yyy">…</span>
 * 配合应用主题（light / dark / system）即可自动适配。
 *
 * 排除范围（由调用方在 before 阶段决定）：
 *   - language-plantuml / language-puml  → plantumlHighlight
 *   - language-mermaid                   → 暂不支持（未启用）
 *   - 其他 language-*                    → shiki 处理
 *
 * 注意：shiki 的 wasm 加载是异步的，所以这个模块导出 createCodeHighlight()
 * 工厂方法，返回一个 unified plugin 闭包。pipeline.ts 在启动时初始化一次，
 * 后续每次 renderMarkdown 复用同一 highlighter 实例。
 */

const SUPPORTED_LANGS = [
  'javascript',
  'typescript',
  'tsx',
  'jsx',
  'json',
  'html',
  'css',
  'scss',
  'bash',
  'shell',
  'python',
  'java',
  'kotlin',
  'swift',
  'go',
  'rust',
  'c',
  'cpp',
  'csharp',
  'ruby',
  'php',
  'sql',
  'yaml',
  'toml',
  'xml',
  'markdown',
  'diff',
  'dockerfile',
  'ini',
  'lua',
  'r',
  'scala',
  'haskell',
  'elixir',
  'erlang',
  'clojure',
  'perl',
  'nginx',
  'makefile',
  'vue',
  'svelte',
] as const

/**
 * 构造 shiki rehype 插件。
 *
 * shiki 4.x 的 `@shikijs/rehype` 默认导出是一个 unified plugin，
 * 它内部管理 highlighter（lazy 模式），无需我们显式创建。
 *
 * pipeline.ts 在首次渲染前 await 一次即可，插件本身是同步返回的，
 * 但 shiki 内部用 lazy 异步加载语言，首次遇到代码块时会 await。
 */
export async function buildCodeHighlightPlugin(): Promise<Plugin> {
  // jsdom 环境跳过 shiki：避免 wasm/onig 加载失败污染测试输出
  if (isJsdomEnvironment()) {
    return noopPlugin
  }
  // rehypeShiki 是 [this: Processor, ...args] 形式的 plugin，unified 调用时不强制 this
  const fn = rehypeShiki as unknown as (
    options?: Record<string, unknown>,
  ) => Plugin
  const plugin = fn({
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
    langs: [...SUPPORTED_LANGS],
    defaultLanguage: 'text',
    fallbackLanguage: 'text',
  })
  return wrapCodeHighlightSafe(plugin)
}

/**
 * 关闭 highlighter。
 * 当前 shiki 4.x 的 @shikijs/rehype 内部管理 highlighter，对外未暴露 dispose；
 * 这里保留 API 以便未来扩展。
 */
export async function disposeHighlighter(): Promise<void> {
  // no-op; shiki 4.x manages lifecycle internally
}

/**
 * 检测是否在 jsdom 测试环境下。
 * shiki 4.x 内部创建 highlighter 需要 wasm / onig 加载器，
 * 在 jsdom 下会异步抛错；为了测试稳定性，在 jsdom 中直接返回 noop plugin。
 */
export function isJsdomEnvironment(): boolean {
  if (typeof navigator === 'undefined') return false
  // jsdom 的特征：navigator.userAgent 包含 'jsdom'
  return /jsdom/i.test(navigator.userAgent ?? '')
}

/**
 * 给 plugin 包装一层错误吞咽：
 *   - 在 jsdom / 没有 wasm 加载器的环境下，shiki 内部 async lazy load 会拒绝
 *   - 我们捕获这些错误并降级为原文本，避免污染测试输出
 */
export function wrapCodeHighlightSafe(plugin: Plugin): Plugin {
  const wrapped = ((...args: unknown[]) => {
    const originalTransformer = (plugin as unknown as (...a: unknown[]) => unknown)(...args)
    if (typeof originalTransformer === 'function') {
      return (tree: unknown) => {
        try {
          const result = (originalTransformer as (t: unknown) => unknown)(tree)
          if (result && typeof (result as { then?: unknown }).then === 'function') {
            return (result as Promise<unknown>).catch((err) => {
              console.warn('[codeHighlight] shiki rejected; falling back to plain text', err)
              return tree
            })
          }
          return result
        } catch (err) {
          console.warn('[codeHighlight] shiki threw; falling back', err)
          return tree
        }
      }
    }
    return originalTransformer
  }) as unknown as Plugin
  return wrapped
}

/**
 * 一个 noop 插件：直接返回 tree，不做任何修改。
 * 用于 jsdom 测试环境，绕过 shiki 的 wasm / onig 依赖。
 */
export const noopPlugin: Plugin = (() => {
  return () => {
    // 返回的 transformer 必须返回 void 或修改后的 tree；noop 直接返回 void
    return undefined
  }
}) as unknown as Plugin

/**
 * 列出当前支持的语言（调试 / UI 提示用）。
 */
export function listSupportedLanguages(): readonly string[] {
  return SUPPORTED_LANGS
}

/**
 * 检查高亮器是否已初始化。
 * shiki 4.x 的 @shikijs/rehype 内部管理 highlighter，无法直接检测；
 * 这里始终返回 true（pipeline 在第一次 await buildCodeHighlightPlugin 时已经初始化）。
 */
export function isHighlighterReady(): boolean {
  return true
}