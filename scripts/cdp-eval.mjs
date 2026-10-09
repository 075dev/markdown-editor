// CDP 探针:在 WebView2 页面内求值一段 JS(临时调试工具,bugfix-005)
// 用法: node scripts/cdp-eval.mjs '<expression>'   (CDP_PORT 默认 9223)
const port = process.env.CDP_PORT || '9223'
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
const page = targets.find((t) => t.type === 'page' && !t.url.startsWith('devtools'))
if (!page) {
  console.error('no page target:', targets.map((t) => `${t.type}:${t.url}`))
  process.exit(1)
}
const ws = new WebSocket(page.webSocketDebuggerUrl)
const expr = process.argv[2]
if (!expr) {
  console.error('usage: node scripts/cdp-eval.mjs <expression>')
  process.exit(1)
}
ws.onopen = () =>
  ws.send(
    JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression: expr, awaitPromise: true, returnByValue: true },
    }),
  )
ws.onmessage = (e) => {
  const r = JSON.parse(String(e.data))
  if (r.id === 1) {
    console.log(JSON.stringify(r, null, 2))
    ws.close()
    process.exit(0)
  }
}
ws.onerror = (e) => {
  console.error('ws error', e)
  process.exit(1)
}
setTimeout(() => {
  console.error('timeout waiting for CDP response')
  process.exit(1)
}, 30000)
