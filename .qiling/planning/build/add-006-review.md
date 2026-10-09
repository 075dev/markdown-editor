# add-006 评审报告(应用内语法速查面板)

- 评审者:ql-reviewer(独立上下文)
- 日期:2026-10-09
- 评审对象:分支 ql/add-005-kuml 工作区中 add-006 增量(基线 main 67171c6)
- 评审深度:STANDARD(新增 7 文件 + 3 接线文件,未触及 auth/schema/密钥路径;任务简报给了精确核对清单)

## 复跑验证(fresh evidence,评审者亲自执行)

| 命令 | 结果 |
|------|------|
| `pnpm typecheck`(vue-tsc --noEmit) | PASS(exit 0,无输出) |
| `pnpm test -- --run` | PASS:Test Files 42 passed (42);Tests 380 passed (380),7.27s |

与 fill 报告声明一致(基线 353 + 新增 27 = 380,零回归;含 add-005 文件的 stripDiagramCode/PreviewPane 测试均绿,确认两增量无交叉回归面——add-006 接线文件 HomeView/TitleBar/main.ts 的 diff 仅含 add-006 hunks,add-005 文件未被 add-006 触碰)。

---

## 结论一:契约合规 — verdict: pass

| # | 契约条款 | verdict | 证据 |
|---|----------|---------|------|
| 1 | 入口三路 | pass | F1:src/views/HomeView.vue(F1 分支置于 ctrl 判定之前,e.preventDefault + toggleSheet,注释块同步加 F1 行);按钮:src/components/TitleBar.vue:132-141(data-testid=open-cheatsheet,「?速查」,title 语法速查 (F1));右键菜单:src/main.ts:79-86(key=syntax-cheatsheet,「语法速查 (F1)」)。三路共用同一模块级单例 |
| 2 | 模态浮层 | pass | role=dialog + aria-modal + aria-label=「语法速查」(SyntaxCheatsheetModal.vue:126-131);打开清空关键词并聚焦搜索框(:25-33);Tab 陷阱 document 层监听(:96-110);Esc 关闭+焦点归还(useSyntaxCheatsheet.ts:43-50,document.contains 守卫)。只拦 Esc/Tab,F1 归 HomeView;Ctrl 分支代码原样未动,装配测试锁定(HomeView.cheatsheet.test.ts:82-107:浮层开时 Ctrl+S 照常保存、F1 仍可关闭) |
| 3 | 内容六节 | pass | 恰 6 节 28 条(12/5/3/3/3/2),条目形状 {id,title,description,snippet},中文说明(syntaxCheatsheet.ts:32-241)。kUML 两条仅用白名单构造:classDiagram(name=)/classOf(name=)/attribute(name,type)/operation(name)/association(source,target)/enumOf(name=)/literal(name=),无臆造 API 名;测试哨兵锁定 kUML snippet 全含 classDiagram(syntaxCheatsheet.test.ts:68-74)。其余五节抽查:mermaid 围栏成对、节点方括号/花括号配对;plantuml 三条 @startuml/@enduml 成对;gfm 表格 3 列表头/分隔/行数一致且对齐冒号合法;KaTeX 命令(\int_0^1 x^2 \, dx、\frac、\sum、\sqrt、希腊字母)合法 |
| 4 | 搜索 | pass | trim+toLowerCase 后对 title/description/snippet 三字段 includes(SyntaxCheatsheetModal.vue:36-50),无 RegExp(无注入面);空态「无匹配条目」(:186);清空恢复六节(测试 :112-122 锁定) |
| 5 | 复制 | pass | 复用 @/services/selection 的 writeClipboard(Modal.vue:16、65-67;签名 (text)=>Promise<WriteResult> 已核对 selection.ts:17);ok→「已复制」/fail→「复制失败」(:58-63),1.5s 复位;全代码无插入编辑器路径(不碰编辑器事务/撤销栈),测试 :124-158 锁定 |
| 6 | 模块级开关不入 settings | pass | useSyntaxCheatsheet.ts 为纯模块级 ref 单例,未 import settings store,无持久化;样式全走主题 CSS 变量(--bg/--bg-elev/--border/--border-strong/--text-1/2/3/--accent-text/--code-bg/--shadow-2/--radius/--font-mono,逐一核对均存在于 src/styles/global.css 亮/暗两套主题) |
| 7 | 已申报偏离:遮罩点击关闭 | pass(合理) | 与 ContextMenu「点外面关闭」惯例一致(Modal.vue:123-124);且 click 事件语义下,从浮层内拖选文本松手在遮罩上时 click 落在共同祖先 .cheatsheet 容器上,遮罩 handler 不触发,无误关风险 |
| 8 | lint 环境限制 | 不再报 | 预存 @eslint/js 缺失,基线同样,按简报豁免 |

---

## 结论二:正确性 — verdict: pass

逐项探测结果:

- **焦点归还时机**:openSheet 在置 open=true **之前**记录触发元素(useSyntaxCheatsheet.ts:40),时机正确;已打开时幂等 no-op 不覆盖触发元素(:39,测试 :35-47);触发元素离文档时 document.contains 守卫静默放弃(:49,测试 :76-85)。
- **focus trap 循环边界**:无可聚焦元素时直接 return 不 preventDefault(不死循环、不锁死);activeElement 不在列表(idx=-1)时落到 focusables[0];首元素 Shift+Tab 回绕公式 (0-1+len)%len=len-1 正确落到末元素。数学核对无误。
- **定时器泄漏**:copyTimers 按 entry id 记录,重复点击先 clearTimeout 旧定时器(Modal.vue:68-70),onBeforeUnmount 全量清理(:80-83)。无泄漏。
- **F1 toggle 语义**:浮层 open 时 F1 → HomeView window 级监听 → toggleSheet → 关闭,Modal 的 document 监听不拦 F1;事件从浮层内冒泡到 window 可达。HomeView.cheatsheet.test.ts:102-105 锁定。
- **Esc 冲突**:浮层关闭时 handler 首行早退(Modal.vue:88),对编辑器 CodeMirror 自身 Esc 处理零干扰;浮层打开时焦点被锁在浮层内,编辑器 keymap 不可能收到 Esc。与 useContextMenu 的 document Esc 监听共存无害(对已关闭菜单是 no-op)。
- **遮罩误关**:见结论一 #7,click 语义已分析,无误关路径。
- **搜索注入**:includes 实现,无 RegExp,无特殊字符注入面。
- **安全小查**:snippet 经 `{{ }}` 文本插值与 `<pre><code>{{ entry.snippet }}</code></pre>` 渲染(Modal.vue:182),全组件无 v-html;数据模块纯静态字面量,无执行语义。通过。

**AI 代码套路清单(S1-S8)扫描:已对照 8 条,未命中。**
- S1/S2:三路入口 handler 全部接到真实 openSheet,无固定值/501 路径;
- S3/S4:复制失败路径显式实现且有测试,无空 catch、无吞错;
- S5:契约字段 {id,title,description,snippet} 全部被消费(id 作状态 key + v-for key,三文本字段入搜索与渲染);
- S6:测试断言渲染结果/焦点位置/按钮文案等行为,writeClipboard 是唯一 mock(外部服务,合理);
- S7:grep TODO/FIXME/placeholder/lorem/临时/示例数据——唯一命中是 useSyntaxCheatsheet.ts:6 注释「纯临时 UI」,为描述性散文非占位残留;
- S8:无请求 schema,不适用。

**无法核实项(如实标注,非 FAIL)**:kUML 第 2 条 snippet 中 `attribute(name = "status", type = status)` 以枚举 val 引用作为 type 实参(非字符串字面量)。本工作区无官方 README 副本、kUML CLI 未安装(add-005 报告已注明),无法离线验证该用法是否为官方 README 形态。所用构造器名均在白名单内,故不定违规;建议交付前对照官方 README 一次性抽验(见 non-critical N1)。

---

## 结论三:代码库一致性 — verdict: pass

- **组合式惯例**:useSyntaxCheatsheet 与 useContextMenu 同构——模块级单例 + document 级监听 + 中文设计要点注释头;readonly(openState) 比 useContextMenu 裸露可写 Ref 更收敛,属改良非漂移。
- **组件惯例**:Teleport 到 body 与 ContextMenu.vue 一致;z-index 9000 低于 ContextMenu 的 9999(菜单选中即关,无同屏重叠问题);BEM 风格类名 + data-testid 密度与 ContextMenu/预览组件一致。
- **样式**:变量全部来自 global.css 既有主题;遮罩 rgba(0,0,0,0.4) 为已申报偏离,而 global.css 自身阴影也直接写 rgba(0,0,0,…) (:118-119、:151-152 等),与库内既有实践一致。
- **测试风格**:中文 describe/it、data-testid 查询、attachTo+真实 focus、fake timers,均与既有组件测试(AutoSaveBanner/PreviewPane 系列)同款。
- **接线风格**:HomeView 快捷键注释块同步更新(既有惯例),TitleBar 按钮属性序列(type/data-testid/title/aria-label)与相邻按钮一致,main.ts 菜单项形状(key/label/onSelect)与 MenuItemSpec 完全吻合。

---

## 发现汇总

### critical(0)

无。

### non-critical(2)

| # | 发现 | 证据 | 说明 |
|---|------|------|------|
| N1 | kUML snippet 的 `type = status`(枚举引用作 type 实参)在本环境无法对照官方 README 核实 | src/data/syntaxCheatsheet.ts:237;工作区无 README 副本、CLI 未安装 | 构造器均在白名单内,不定违规;建议交付前一次性抽验,若官方仅支持字符串 type 则该条渲染时会 fail(有降级路径,不阻断编辑) |
| N2 | gfm-table 描述「第二行的连字符至少三个」过严:GFM 单个 `-` 亦可渲染 | src/data/syntaxCheatsheet.ts:118 | 内容文案精度小偏差,不影响功能;snippet 本身合法 |

---

## 总体裁定

**verdict: approved**(0 critical,2 non-critical)

复跑证据:`pnpm typecheck` exit 0;`pnpm test -- --run` 42 files / 380 tests 全绿。
