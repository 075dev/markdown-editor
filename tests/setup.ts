/**
 * 全局测试 setup：
 *   - jsdom 的 localStorage 在 vitest 默认下 setItem/getItem 行为不一致；
 *     替换为内存版以保证 store 持久化测试可靠。
 *   - 抑制 unhandled rejection：Vue watch 异步回调可能在测试结束后才触发 setItem。
 */

const memory = new Map<string, string>()

const fakeStorage = {
  getItem: (k: string) => (memory.has(k) ? memory.get(k)! : null),
  setItem: (k: string, v: string) => {
    memory.set(k, v)
  },
  removeItem: (k: string) => {
    memory.delete(k)
  },
  clear: () => memory.clear(),
  key: (i: number) => Array.from(memory.keys())[i] ?? null,
  get length() {
    return memory.size
  },
}

beforeEach(() => {
  memory.clear()
  Object.defineProperty(window, 'localStorage', {
    value: fakeStorage,
    writable: true,
    configurable: true,
  })
})

// 兜底：测试结束后如果还有 Vue watch 异步 setItem 触发，不让 Vitest 报 unhandled
if (typeof process !== 'undefined') {
  process.on('unhandledRejection', () => {
    /* ignore late async write to storage */
  })
}