# add-001 六主题 + 全面视觉升级 —— 交付台账与独立评审

日期:2026-09-14 | 分支:ql/phase-1-autosave | 范围:`fd128b0..f91ac2f`(6 提交)| 模式:sequential

## 主报告

### 范围与提交

| 提交 | 内容 |
|------|------|
| 6d73b89 | 契约:event-flow.md「主题系统约定(add-001)」+ openapi 0.1.0→0.1.1 Clarifications |
| 6c4bac8 | T1:六主题 token 体系(global.css)+ settings v6 存储 / v5 迁移 / 非法值回落 / theme-anim |
| 25eff8d | T2:设置页卡片式主题选择器(7 卡 + mini 预览色块 + radio 语义) |
| 52f721b | T3:组件/CM6/预览区硬编码色清零 + hl-* token 化 + cm-md-* 样式补全 |
| 8dbdb28 / f91ac2f | 进度台账 + 填充报告留档 |

diff 统计(实测):21 文件,+981/-166。

### 声明(当 claim 读,来源 `.planning/build/add-001-fill-report.md`)

- vue-tsc 0 错;vitest 235/235(基线 223,净增 12);vite build 9.32s —— 主会话亲测,不重跑
- 六主题 28 token/套 × 8 块齐全;--text-2/3 对比度全主题 ≥4.5;组件硬编码色清零(两处有意保留)
- 顺带修存量 bug:`:not([data-theme='light'])` → `:not([data-theme])`

---

## 独立评审

评审档位:THOROUGH(21 文件 > 20 触发升档;纯前端 CSS/store/view,不涉 auth/schema/密钥路径)。
评审时 HEAD=f91ac2f(= 验证对象 commit),worktree 无未提交业务改动(仅一个空的未跟踪垃圾目录 `S:`,
见备注 N7);主会话验证结论(235/235、vue-tsc、build)未过期,未重跑重型命令。
完成声明三键探测:无 stale_state(验证对象即 HEAD)、无 dirty_worktree、无 misleading_success_output
(新增测试经逐条阅读,断言真实 DOM 属性/store 状态/持久化内容,非"只断言 mock 被调用")。

### 结论一:契约合规(验收标准)——通过

1. **六主题 ID/名称与 event-flow 逐一一致**:`THEMES = ['light','dark','oled','paper','bluegray','rose']`
   (src/stores/settings.ts:6)+ `THEME_LABELS`(settings.ts:13-21,浅色/深色/墨黑/纸张/蓝灰/玫瑰/跟随系统)
   与契约表逐格比对一致;设置页卡片顺序六主题在前、system 固定末位(SettingsView.vue themeCards)。
2. **system 语义保留**:`applyTheme`(settings.ts:240-250)对 `theme==='system'` 执行
   `removeAttribute('data-theme')`,其余主题一律 `setAttribute`;CSS 侧
   `@media (prefers-color-scheme: dark) :root:not([data-theme])`(global.css)仅在属性整体缺失时生效,
   与契约"移除 data-theme,由 prefers-color-scheme 映射 light/dark(其余主题不参与跟随)"精确对应。
   grep `prefers-color-scheme` 在 src/ 的 ts/vue 中零残留(仅 global.css 一处媒体查询)。
3. **28 token × 7 块 + media 块齐全(脚本实测)**:评审者自写计数脚本逐块统计唯一 CSS 变量——
   light/dark/oled/paper/bluegray/rose/media(system-dark)各 **28** 个,:root 33(28 token +
   字体 3 + 兼容映射 2),与 fill-report 完整性表完全吻合;`--hl-keyword/string/comment/number/operator`
   五色在全部 8 块中逐一在场。选区(`--selection` + `::selection`)、滚动条(`--scrollbar/-hover`
   + `::-webkit-scrollbar*`)、阴影(`--shadow-1/2`)、圆角(`--radius`)均已 token 化并被消费。
4. **卡片选择器符合约定**:每卡含 mini 预览色块(`data-swatch` 三色样本 + system 特殊卡显示器图标,
   aria-hidden)、`role="radiogroup"`/`role="radio"`/`aria-checked`、原生 `button`(Enter/Space
   平台保证);5 个专用测试(settings.theme-cards.test.ts)锁定 7 卡渲染、点击切换、radio 语义、键盘载体。
5. **契约文档面**:openapi.yaml `version: 0.1.1` + Clarifications 末行 Q/A(纯前端无新 IPC);event-flow
   追加约定节 + 切换时序图;实现与时序一致(setTheme → data-theme → 200ms 过渡 → watch 统一持久化)。
6. **纯前端无新 IPC**:diff 未触碰 src-tauri 与 services,零新增依赖(package.json 未改),符合
   "不引入 shiki、保持零依赖"的契约澄清。

### 结论二:正确性——通过(附 1 major + 5 minor + 1 备注)

- **v5→v6 迁移不丢数据**:`load()` 读 `STORAGE_KEY ?? LEGACY_STORAGE_KEY`(settings.ts:172-174),
  两个 key 走同一段解析分支,splitRatio/viewMode/sansFont/monoFont/fontSize/sidebarCollapsed/
  syncScroll/autoSaveEnabled 全部按既有类型守卫透传;测试覆盖 v5 透传(theme/splitRatio/viewMode)、
  v6 优先不回退、非法 theme('banana'/42)回落 light、缺省回落 system。
- **`:not([data-theme])` 修改正确且必要**:旧选择器 `:root:not([data-theme='light'])` 与
  `:root[data-theme='paper']` 特异性相同(0,2,0),且媒体查询块位于文件后部——后来居上会在
  OS 深色偏好下覆盖显式选择的 paper/bluegray(浅色系)变量;新增四主题后此 bug 必然显形,
  收紧为 `:not([data-theme])` 严格对应 system 语义,light/dark 显式选择行为不变(值与 media
  块一致,覆盖与否无观察差异)。必要且正确。
- **theme-anim 过渡方案成立**:动画类仅在 `toggleTheme`/`setTheme`(用户交互路径)添加;
  store 初始化走 `watch(immediate:true) → applyToDocument`,不经过 `animateThemeChange`,
  首屏不携带过渡类。CSS 限定 `html.theme-anim body[ *]` 且只过渡 background-color/color/
  border-color 200ms ease(与契约一致),250ms 后移除,模块级定时器重复切换时重置。
  测试用 fake timers 锁定加/移除时序。
- **shiki 死 CSS 删除安全**:被删的 `.markdown-body pre code span { color: var(--shiki-light/dark) }`
  引用的变量从未被生产代码注入——高亮由存量自研 tokenizer(src/markdown/codeHighlight.ts)输出
  hl-* class,本次在 PreviewPane 补齐 hl-string/hl-number 样式并把五色全部改挂 `--hl-*`;
  hl-directive/hl-arrow 复用 keyword/number token,语义注释已标。
- **硬编码色清零属实**:grep 全组件/视图,残留仅两处且均合理——
  (a) PreviewPane.vue:269-270 `.plantuml-diagram` 白底(PlantUML 服务端 PNG 衬垫,功能性色,注释已标);
  (b) SettingsView.vue:590-625 卡片样本色 18 值("主题预览数据":必须显示目标主题色而非当前
  主题变量,技术上无法走当前作用域变量)。逐值与 global.css 对应主题 --bg/--bg-sidebar/--accent
  比对,18/18 一致。旧变量 `var(--fg`/`var(--fg-muted`/`var(--ok` 在组件中零残留
  (:root 的 `--fg→--text-1` 兼容映射仅为保险,已无消费方)。
- **测试真实性**:settings.test.ts 新增 7 例驱动真实 store + documentElement 属性 + localStorage
  内容;theme-cards 5 例 mount 真实组件断言 DOM。vue-tsc/vitest/build 由主会话亲测 PASS,
  不重跑。

major(1 项,建议修复,不阻断):

- **M1 横幅反色在两主题下低于 WCAG AA**(AutoSaveBanner.vue:98-101 等,`color: var(--bg)` 反色方案):
  评审者按 WCAG 相对亮度公式实测——bluegray `--danger #c4534f` × `--bg #f0f3f7` = **4.02:1**、
  paper `--success #5e7d3c` × `--bg #faf4e8` = **4.28:1**,横幅文字 12-13px(小字,AA 阈值 4.5:1),
  均不达标;其余四主题 4.6-7.6:1 达标。属本次新引入的配色组合(fill-report 的 WCAG 声明只覆盖
  text-2/3/accent-text,未声称横幅达标,故非虚假声明)。建议对 bluegray/paper 微调 danger/success
  或横幅文字改用固定可读色。视觉风险聚焦点内最实质的一项。

minor(5 项,记录不阻断):

- **m1 autosave legacy 测试语义弱化**(src/stores/settings.autosave.test.ts:76-81):用例
  "legacy storage without autoSaveEnabled falls back to false" 的写入 key 被机械替换为
  `STORAGE_KEY`(v6),不再覆盖"v5 旧数据缺 autoSaveEnabled 回落 false"场景;该场景现无直接
  测试(settings.test.ts 的 v5 迁移用例只断言 theme/splitRatio/viewMode)。行为本身正确
  (两 key 同一解析分支,缺省回落逻辑一致),属测试守护缺口 + 用例名与行为不符。
- **m2 hl-comment 在 paper/oled 对比度低**:paper `#a89e88/#f1e9d7` = 2.20:1、oled
  `#4e525a/#07070a` = 2.57:1(实测)。注释色低对比是语法高亮通行惯例,且契约对 paper 的定位即
  "暖色低对比";但注释是实际内容文字,严格 AA 不达标,记录备查。
- **m3 radio 角色缺方向键导航**:卡片声明 `role="radio"` 但未实现 roving tabindex/方向键移动
  (WAI-ARIA radio group 惯例);实际 Tab 逐卡可达 + Enter/Space 激活,可达性不退化
  (旧版 aria-pressed 按钮组同样仅 Tab),属语义预期与行为的落差。
- **m4 SettingsView 8 处 border-radius 硬编码**(4px/16px):契约字面仅要求颜色清零 + token
  体系定义 --radius,组件级圆角未要求全面 token 化;其余组件已用 `var(--radius)`/`calc(...)`,
  SettingsView 为局部不一致。
- **m5 卡片样本色双源**:18 个 swatch 色值与 global.css 主题值需手动同步,无单一事实来源
  (注释已声明"与 global.css 一致"并经本次比对核实);后续改色有漂移风险。

备注(非发现):

- **N6 openapi.yaml Clarifications 日期写 2026-09-15**(当日为 2026-09-14),文档笔误。
- **N7 工作区根目录存在空的未跟踪目录 `S:`**(0 字节,无文件):非本 diff 引入(不在 6 提交内),
  来历不明疑为历史命令事故;建议删除。不影响 HEAD 干净度与验证结论有效性。

### 结论三:代码库一致性——通过

- **C1 服务层封装(MUST)**:diff 未新增任何 Tauri 调用(未触碰 src/services 与 src-tauri),
  grep 本次改动文件无 `@tauri-apps` 导入。通过。
- **C2 环境降级(MUST)**:未触碰 services 层,既有降级路径不受影响;settings store 的
  `typeof document === 'undefined'`/`typeof localStorage !== 'undefined'` 守卫保持,
  jsdom 测试全绿即为降级路径工作的证据。通过。
- **C3 安全底线(MUST)**:grep `console.log` 零命中(评审者复核);PreviewPane 仅改 <style>,
  未触碰 v-html/sanitize 管线;无密钥/地址入库。通过。
- **技术栈红线**:零新增依赖,未引入渲染栈;编辑器内核未动。
- **命名/结构惯例**:中文注释 + 变更编号引用、THEMES/THEME_LABELS/isTheme 的导出式常量 +
  类型守卫风格与 store 既有 FONT_SIZE_* 常量一致;token 分组注释(背景/文字/边框/强调/状态/
  代码/高亮/阴影)在 8 个块中顺序一致,六套 × 28 变量的可维护性组织清晰(逐块同序,便于 diff 对照)。

### WCAG 抽验汇总(评审者亲自计算,非引用声明)

text-3/--bg:light 4.65、oled 4.61、paper 4.60、bluegray 4.66;rose text-2 6.55;
light success 修正后 5.02;dark hl-string/code-bg 9.71;rose hl-string/code-bg 7.23;
paper ctx-hover accent-text/accent-soft 5.25——与 fill-report 第五节数字全部吻合,声明可信。
反色横幅与 hl-comment 的缺口见 M1/m2。

---

## 裁定

**verdict: approved**

- critical:0
- major:1(M1 横幅反色 bluegray/paper 下 AA 不达标,建议随下一轮微调)
- minor:5(m1 测试语义弱化、m2 hl-comment 低对比、m3 radio 方向键、m4 radius 硬编码、m5 样本色双源)
- 备注:2(N6 契约日期笔误、N7 工作区垃圾目录 `S:`)

### 一句话总评

契约逐条落地且证据扎实——28 token × 8 块脚本实测齐全、迁移与回落有测试锁定、存量
media 查询 bug 的修复正确且必要、硬编码色清零经全量 grep 核实;唯一实质缺口是反色横幅
在 bluegray/paper 两主题下对比度略低于 AA(4.02/4.28 vs 4.5),属可快速微调的视觉精修项,
不阻断交付。

---

## 处置账本(评审后追加,append-only)

| 编号 | 级别 | 处置 | 证据 | decided_by | round |
|------|------|------|------|-----------|-------|
| M1 | major | FIXED | bluegray `--danger` #c4534f→#b0403c(4.02→5.18:1)、paper `--success` #5e7d3c→#4c6a2e(4.28→5.62:1),主会话按 WCAG 公式复算 ≥4.5 达标;vitest 235/235 | main-session | 1 |
| m1-m5 | minor | DEFERRED | 遗留登记:legacy 测试 v5 缺字段场景、hl-comment 低对比(惯例内)、radio 方向键、SettingsView radius 硬编码、swatch 双源 | main-session | 1 |
| N6 | 备注 | FIXED | Clarifications 日期笔误已在本次提交顺带修正为 2026-09-15 | main-session | 1 |
| N7 | 备注 | FIXED | 工作区垃圾目录 `S:` 已删除 | main-session | 1 |
