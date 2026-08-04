#!/usr/bin/env node
// scripts/verify-plantuml.mjs
//
// 端到端验证 plantuml-encoder 与官方服务的连通性：
//   1. 调用本地 plantuml-encoder 把示例源码编码成 URL 段
//   2. 实际请求 https://www.plantuml.com/plantuml/svg/<encoded>
//   3. 验证返回 200 + Content-Type: image/svg+xml
//
// 这是 PlantUML 渲染集成的"真"冒烟测试。

import plantumlEncoder from 'plantuml-encoder'

const source = `@startuml
Alice -> Bob: Hello
@enduml`

const encoded = plantumlEncoder.encode(source)
console.log('[1] encoded length:', encoded.length)

const url = `https://www.plantuml.com/plantuml/svg/${encoded}`
console.log('[2] url:', url.slice(0, 80) + '...')

try {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'markdown-editor-verify/0.1' },
  })
  console.log('[3] status:', res.status)
  console.log('[4] content-type:', res.headers.get('content-type'))
  const body = await res.text()
  console.log('[5] body[:120]:', body.slice(0, 120))
  if (res.status === 200 && /^(<\?xml|<svg)/.test(body)) {
    console.log('OK plantuml.com is reachable and returns SVG')
  } else {
    console.error('FAIL: unexpected response')
    process.exit(1)
  }
} catch (err) {
  console.error('FAIL: network error:', err.message)
  process.exit(1)
}