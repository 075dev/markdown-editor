---
task: add-006-fill-w1
wave: 1
worker: ql-builder-worker
status: success
---

# 单任务报告:add-006 应用内语法速查面板(W1 填充)

## 实现说明

实现「语法速查」模态浮层:六节语法内容(Markdown 基础 12 条 / GFM 扩展 5 条 / 数学 KaTeX 3 条 / mermaid 3 条 / PlantUML 3 条 / kUML 2 条,共 28 条)打包内置离线可用;三路入口(F1 全局键、标题栏「?速查」按钮、编辑器右键菜单项)共用模块级单例组合式状态;浮层带关键词过滤(大小写不敏感,命中 title/description/snippet)、条目级一键复制(反馈「已复制/复制失败」1.5s 复位)、Esc 关闭归还焦点、Tab 焦点循环锁浮层;其余全局快捷键在浮层打开时行为不变(有装配测试锁定)。

## 修改文件

**新增:**
- `src/data/syntaxCheatsheet.ts` — 六节速查数据(`CheatSection`/`CheatEntry` 形状按契约);kUML 节仅用官方验证过的 Kotlin DSL 构造(classOf/enumOf/attribute/operation/association/literal),description 注明需 kuml CLI(choco install kuml)
- `src/data/syntaxCheatsheet.test.ts` — 6 用例:恰 6 节、条目数下限(10/5/3/3/3/2)、id 唯一、字段非空、kUML snippet 全含 classDiagram(防臆造哨兵)、围栏闭合
- `src/composables/useSyntaxCheatsheet.ts` — 模块级单例组合式(openSheet/closeSheet/toggleSheet + 只读 open;不入 settings),沿用 useContextMenu 惯例
- `src/composables/useSyntaxCheatsheet.test.ts` — 7 用例:状态机、幂等 openSheet、焦点归还、触发元素离文档容错、单例
- `src/components/SyntaxCheatsheetModal.vue` — 浮层(Teleport 到 body,与 ContextMenu.vue 惯例一致)
- `src/components/SyntaxCheatsheetModal.test.ts` — 12 用例
- `src/views/HomeView.cheatsheet.test.ts` — 2 用例:F1→toggle 装配;浮层打开时 Ctrl+S 照常保存且 F1 仍可关闭

**修改(均为纯增量,未删改既有行为):**
- `src/views/HomeView.vue` — 全局 keydown 在 ctrl 判定**之前**加 F1 分支(toggleSheet);快捷键注释块加 F1 行;模板挂载 `<SyntaxCheatsheetModal />`
- `src/components/TitleBar.vue` — 「另存为」与 ⚙ 之间加「?速查」按钮(data-testid=open-cheatsheet,title「语法速查 (F1)」)
- `src/main.ts` — 编辑器右键菜单 items 追加「语法速查 (F1)」项(key=syntax-cheatsheet)

## 实现要点

### 焦点归还实现
`openSheet()` 缺省记录 `document.activeElement`(可显式传 trigger,仅收 HTMLElement);`closeSheet()` 在 `document.contains(triggerElement)` 成立时 `focus()` 归还,触发元素已离文档(路由/重渲)则静默放弃。openSheet 已打开时幂等 no-op,不覆盖触发元素。

### focus trap 边界
浮层打开期间在 **document 层** keydown 监听(组件 mounted 挂一次)内拦截:Esc → closeSheet(焦点归还);Tab → 查询浮层内可聚焦元素(`button:not([disabled]), input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])`),按 DOM 序循环(Shift+Tab 反向),`preventDefault` 阻止逃逸。浮层只拦 Esc/Tab,**F1 由 HomeView 全局处理器管**(toggle),Ctrl+S/N/O 等组合键不受浮层影响——F1 分支置于 ctrl 判定之前,其余分支原样放行(HomeView.cheatsheet.test.ts 第 2 例锁定该行为)。

### 复制反馈
`writeClipboard(entry.snippet)`(src/services/selection.ts 的 `{ok}` 签名,已 VERIFIED);按条目 id 记录 `idle/copied/failed` 状态,`setTimeout 1500ms` 复位,连续点击重置旧定时器,卸载时统一 clear;多按钮状态互相独立(有测试锁定)。复制只写剪贴板,不插入编辑器。

### 其它
- 搜索:`keyword.trim().toLowerCase()` 对三字段包含匹配,节内过滤后空节隐藏,全空显示「无匹配条目」,清空恢复六节;每次打开清空关键词并聚焦搜索框
- 样式全走 CSS 变量(--bg/--bg-elev/--border/--text-*/--code-bg/--shadow-2/--radius 等),卡片 `width: min(820px, 100%)` + `max-height: 80vh` + 内部滚动,无硬编码颜色(遮罩半透明黑除外,与浮层语义一致的通用遮罩)
- 无障碍:role=dialog + aria-modal + aria-label=「语法速查」,搜索框 aria-label

## 测试结果

```
$ pnpm typecheck
$ vue-tsc --noEmit
(无输出,exit 0)

$ pnpm test -- --run
 Test Files  42 passed (42)
      Tests  380 passed (380)
```

基线 353 + 新增 27(6+7+12+2)= 380,零回归。

## 提交

- 无 git 提交(简报明确要求:工作区含 add-005 未提交变更,禁止 commit;变更留在工作树交协调器统一处理)

## 已知问题 / 与契约的偏离

1. **[偏离·标注] 遮罩点击也可关闭浮层**:契约只规定 Esc 关闭;补充了点遮罩关闭(与 ContextMenu「点外面关闭」的既有交互惯例一致),不影响 Esc 语义。
2. **[偏离·标注] 标题栏按钮文字采用契约建议值「?速查」**,title 为「语法速查 (F1)」——契约允许「?速查或等效」,非实质偏离。
3. **[环境] `pnpm lint` 无法运行**:`eslint.config.js` 依赖的 `@eslint/js` 包在本工作区未安装(预存状况,与本次变更无关);简报指定验证(typecheck + 全量测试)全绿。新文件按既有风格书写,未跑 lint 属环境限制,非跳过。
4. 测试中 Vue 状态更新会替换复制按钮 DOM 节点,断言须重新 find——已按此写测试(组件行为本身正确,jsdom 下同样成立)。

## 关键指标

- 代码行数:+37(3 个接线文件,纯增量)+ 新增 7 文件(数据 196 行 / 组件 289 行 / 组合式 77 行 + 测试 3 文件约 480 行,约数)
- 测试用例:新增 27,总 380/380 全绿
