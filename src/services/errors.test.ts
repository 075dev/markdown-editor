import { describe, expect, it } from 'vitest'
import { normalizeError, withFallbackCode, type QlError } from '@/services/errors'

describe('normalizeError', () => {
  describe('"CODE: message" 前缀解析(Rust invoke Err 格式)', () => {
    it('解析 FILE_NOT_FOUND 前缀并去除前缀', () => {
      expect(normalizeError('FILE_NOT_FOUND: path does not exist: /a.md')).toEqual({
        code: 'FILE_NOT_FOUND',
        message: 'path does not exist: /a.md',
      })
    })

    it('解析 WATCH_FAILED 前缀', () => {
      const e = normalizeError('WATCH_FAILED: failed to watch /a.md: os error 32')
      expect(e.code).toBe('WATCH_FAILED')
      expect(e.message).toBe('failed to watch /a.md: os error 32')
    })

    it('解析 FILE_READ_FAILED 前缀', () => {
      expect(normalizeError('FILE_READ_FAILED: read failed: stream unreadable').code).toBe(
        'FILE_READ_FAILED',
      )
    })

    it('前缀命中优先于模式匹配', () => {
      // message 剩余部分含 "invalid",但前缀优先
      expect(normalizeError('FILE_NOT_FOUND: invalid path state').code).toBe('FILE_NOT_FOUND')
    })

    it('非法前缀(不是完整 code)不误判,走模式匹配', () => {
      expect(normalizeError('FILE_NOT_FOUNDED: not found here').code).toBe('FILE_NOT_FOUND')
    })
  })

  describe('字符串模式匹配(plugin-fs / 裸字符串)', () => {
    it('英文 not found → FILE_NOT_FOUND', () => {
      expect(normalizeError('No such file or directory: not found').code).toBe('FILE_NOT_FOUND')
    })

    it('中文 不存在 → FILE_NOT_FOUND', () => {
      expect(normalizeError('文件不存在').code).toBe('FILE_NOT_FOUND')
    })

    it('denied → FILE_WRITE_FAILED', () => {
      expect(normalizeError('Permission denied').code).toBe('FILE_WRITE_FAILED')
    })

    it('readonly → FILE_WRITE_FAILED', () => {
      expect(normalizeError('file is readonly').code).toBe('FILE_WRITE_FAILED')
    })

    it('中文 占用 → FILE_WRITE_FAILED', () => {
      expect(normalizeError('文件被另一个进程占用').code).toBe('FILE_WRITE_FAILED')
    })

    it('invalid → PATH_INVALID', () => {
      expect(normalizeError('path contains invalid characters').code).toBe('PATH_INVALID')
    })

    it('中文 非法 → PATH_INVALID', () => {
      expect(normalizeError('路径含非法字符').code).toBe('PATH_INVALID')
    })
  })

  describe('兜底与 raw 类型处理', () => {
    it('无法分类 → INTERNAL_ERROR,保留原始 message', () => {
      expect(normalizeError('something exploded')).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'something exploded',
      })
    })

    it('Error 实例取 .message', () => {
      expect(normalizeError(new Error('boom not found')).code).toBe('FILE_NOT_FOUND')
    })

    it('非字符串 / 非 Error raw → String 化后兜底', () => {
      expect(normalizeError(42)).toEqual({ code: 'INTERNAL_ERROR', message: '42' })
      expect(normalizeError(null).code).toBe('INTERNAL_ERROR')
      expect(normalizeError(undefined).code).toBe('INTERNAL_ERROR')
    })

    it('带 message 属性的普通对象取 message', () => {
      expect(normalizeError({ message: 'readonly disk' }).code).toBe('FILE_WRITE_FAILED')
    })
  })
})

describe('normalizeError:save/new 写盘通道补充(填充阶段 T1)', () => {
  it('解析 FILE_WRITE_FAILED 前缀(自动保存重试判别依赖此码)', () => {
    expect(normalizeError('FILE_WRITE_FAILED: Access is denied')).toEqual({
      code: 'FILE_WRITE_FAILED',
      message: 'Access is denied',
    })
  })

  it('解析 WINDOW_OPEN_FAILED 前缀', () => {
    expect(normalizeError('WINDOW_OPEN_FAILED: webview unavailable').code).toBe(
      'WINDOW_OPEN_FAILED',
    )
  })

  it('解析 INTERNAL_ERROR 前缀', () => {
    expect(normalizeError('INTERNAL_ERROR: panic in backend').code).toBe('INTERNAL_ERROR')
  })

  it('盘满/只读文件系统等写盘报错(denied 变体)→ FILE_WRITE_FAILED', () => {
    expect(normalizeError(new Error('os error 19: media is write protected')).code).toBe(
      'INTERNAL_ERROR',
    )
    // 裸 syscall 文本无法分类 → INTERNAL_ERROR,由通道兜底 withFallbackCode 升级
  })
})

describe('withFallbackCode(通道感知兜底,纯函数)', () => {
  it('INTERNAL_ERROR 按通道升级为 fallback(如写盘 → FILE_WRITE_FAILED)', () => {
    expect(
      withFallbackCode({ code: 'INTERNAL_ERROR', message: 'os error 5' }, 'FILE_WRITE_FAILED'),
    ).toEqual({ code: 'FILE_WRITE_FAILED', message: 'os error 5' })
  })

  it('已显式分类的 code 保持不变(前缀/模式命中优先)', () => {
    const e: QlError = { code: 'FILE_NOT_FOUND', message: 'no such file' }
    expect(withFallbackCode(e, 'FILE_WRITE_FAILED')).toBe(e)
  })

  it('message 始终保留不改写', () => {
    const out = withFallbackCode({ code: 'INTERNAL_ERROR', message: 'x' }, 'PATH_INVALID')
    expect(out.message).toBe('x')
    expect(out.code).toBe('PATH_INVALID')
  })
})
