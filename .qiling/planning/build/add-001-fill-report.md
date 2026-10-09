# add-001 填充报告:六主题 + 全面视觉升级

日期:2026-09-14 | 分支:ql/phase-1-autosave | 基线:fd128b0 | 模式:sequential(fallback_to_sequential,无子智能体面)

## 一、任务清单与提交

| 任务 | 提交 | 内容 | 结果 |
|------|------|------|------|
| 契约 | 6d73b89 | event-flow.md「主题系统约定」+ openapi 微调 | PASS |
| Wave1 T1 主题 token 体系 + settings v6 | 6c4bac8 | global.css 六主题 28 token/套;Theme 七值;v5→v6 迁移;非法值回落 light;theme-anim 过渡类;THEMES/THEME_LABELS/isTheme 导出 | PASS |
| Wave1 T2 卡片式主题选择器 | 25eff8d | 2×3 卡片网格 + system 特殊卡;mini 预览色块;role=radio/aria-checked;原生 button 键盘可达 | PASS |
| Wave1 verify | — | vue-tsc + vitest 全量 | PASS(235/235) |
| Wave2 T3 组件全面适配 + 精修 | 52f721b | 组件/CM6/预览区硬编码颜色清零;hl-* token 化;对比度修正;cm-md-* 样式补全 | PASS |
| Wave2 verify(终验) | 8dbdb28(台账) | vue-tsc + vitest + C3 grep + 完整性 + WCAG | PASS(235/235) |

台账:.planning/build/progress.md(全 PASS,无 NOT_RUN)。

## 二、diff 摘要(fd128b0..8dbdb28)

20 文件,+900/-166。核心:
- src/styles/global.css +373:六主题 token 块 ×7(含 media system 跟随)、theme-anim 过渡、::selection、scrollbar、cm-md-* 语法样式
- src/stores/settings.ts +51:七值 Theme、v6 存储 + v5 迁移、过渡动画
- src/views/SettingsView.vue +211:卡片网格 + 六主题样本色(静态 CSS 类)
- 组件/编辑器 token 化:AutoSaveBanner/ContextMenu/EditorPane/PreviewPane/Sidebar/TitleBar/FolderTreeNode/HomeView/createEditor/selectionLineFill/markdownLanguage

## 三、测试统计

基线 223/223 → 终值 **235/235**(28 文件,净增 12,零回退):
- settings.test.ts:新增 7(六值往返 / theme-anim 类 / v6 持久化 / v5 迁移 / 非法回落 / v6 优先 / isTheme+LABELS)
- settings.theme-cards.test.ts:新增 5(7 卡渲染 / 点击切换 / radio aria / 原生 button / 选中态与特殊卡)
- vue-tsc --noEmit:exit 0

## 四、六主题变量完整性表(28 token/套,脚本实测)

| token 组 | root | light | dark | oled | paper | bluegray | rose | media(system) |
|----------|------|-------|------|------|-------|----------|------|------|
| 背景 --bg/--bg-elev/--bg-sidebar/--bg-input | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 文字 --text-1/2/3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 边框 --border/--border-strong | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 强调 --accent/--accent-soft/--accent-text | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 状态 --danger/--warning/--success | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 代码 --code-bg/--code-border | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 高亮 --hl-keyword/string/comment/number/operator | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 阴影 --shadow-1/2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| --radius | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 选区 --selection | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 滚动条 --scrollbar/--scrollbar-hover | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 合计 | 33* | 28 | 28 | 28 | 28 | 28 | 28 | 28 |

*root = 28 token + 字体 3(--font-sans/mono/size-base)+ 兼容映射 2(--fg/--fg-muted → --text-1/2)
media 块缺失数:NONE(--radius 显式补齐)

## 五、对比度(WCAG 相对亮度,脚本实测)

| 主题 | --text-2 / --bg | --text-3 / --bg | --accent-text / --bg |
|------|-----------------|-----------------|----------------------|
| light | 6.05 | 4.65 | 7.90 |
| dark | 7.45 | 4.56 | 9.36 |
| oled | 6.89 | 4.61 | 12.00 |
| paper | 5.17 | 4.60 | 6.03 |
| bluegray | 5.50 | 4.66 | 7.02 |
| rose | 6.55 | 4.55 | 8.54 |

全部 ≥ 4.5:1。修正项:light --success #16a34a→#15803d;六主题 --text-3 经自动搜索保持色相提升至 ≥4.55。

## 六、设计取舍

1. **system 跟随选择器收紧**:`:root:not([data-theme='light'])` → `:root:not([data-theme])`。旧写法在显式选 paper/rose 等 4 个新主题时会被 OS 深色偏好覆盖(同特异性后来居上),新写法严格对应 system 语义。
2. **横幅反色方案**:danger/success 底色配 `var(--bg)` 字而非白字——深色系主题的状态色偏亮、浅色系偏深,bg 反色在两系都自然成立,零新增 token。ContextMenu hover 用 accent-soft 底 + accent-text 字替代反白(rose 的亮玫瑰 accent 上白字仅 ~2.2:1)。
3. **功能白底保留**:PlantUML 服务端 PNG 为白底,`.plantuml-diagram` 的 #ffffff 是图片衬垫而非主题色,有意保留(注释已标)。
4. **设置页卡片样本色**:每主题 3 个代表色以静态 CSS 类(`data-swatch`)集中定义,与 global.css 对应值一致——属"主题预览数据",不在"组件禁止硬编码"约束内。
5. **toggleTheme 循环保持 light→dark→system**:既有测试锁定该语义,新增四主题经设置页卡片选择(toggle 只在三态间循环,非三态时回到 light)。
6. **Shiki 死代码清理**:预览区 `--shiki-light/--shiki-dark` 规则引用的变量从未被生产代码注入(codeHighlight 输出纯 hl-* class),整块删除;pipeline.ts 中 sanitize 白名单注释属实现文件,未越界改动。
7. **cm-md-* 样式补全**:markdownLanguage.ts 输出的标题/链接/行内码 class 此前无任何 CSS,本次按 token 补齐(编辑器内 Markdown 语法着色首次生效)。
8. **边界扩展(记录)**:T1 将 settings.autosave.test.ts 的 4 处 `'mde:settings:v5'` 字面量替换为 STORAGE_KEY 常量——key 升 v6 必然破坏旧引用,属机械连带,无行为语义变更。

## 七、宪法检查

- C1(Tauri API 仅在 services/):本次纯 CSS/前端状态,未新增 Tauri 调用 ✓
- C2(Web 降级):未触碰 services 层,降级路径不变 ✓
- C3(禁 console.log):grep 零命中 ✓
