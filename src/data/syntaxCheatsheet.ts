/**
 * 应用内语法速查面板(add-006 建立,add-007 / add-008 扩充)的内容数据。
 *
 * 设计要点:
 *   - 纯静态数据,打包内置,离线可用;不读文件、不发请求。
 *   - 六节与编辑器支持的语法域一一对应:Markdown 基础 / GFM 扩展 /
 *     数学(KaTeX) / mermaid / PlantUML / kUML,共 97 条(add-008)。
 *   - 只收录编辑器渲染得出的语法(remark-gfm / KaTeX / mermaid 11 /
 *     PlantUML 标准集);渲染不出的一律不收(如 ==高亮==,remark-gfm 不支持)。
 *   - snippet 是「用户可直接照抄进编辑器」的完整示例文本:
 *     围栏类示例(mermaid)自带 ``` 围栏;@startuml / Kotlin DSL 类
 *     示例是裸源码,由编辑器的图表识别逻辑接管。
 *   - add-008 新增条目全部实证后才收录:mermaid 候选逐条通过
 *     mermaid.parse 探针(其中 quadrantChart / requirementDiagram /
 *     xychart-beta 的中文文本必须引号包裹才可解析),PlantUML 候选
 *     逐条经官方渲染服务验证(简报中的「[任务] is N days」甘特写法
 *     实测语法错误,已改用验证通过的 lasts/then/happens at)。
 *   - kUML 节只收官方验证构造,四来源:GitHub README Quick Start
 *     (类图/枚举/关联多重性聚合)、kuml.dev/llm(时序图)、官方 examples
 *     kuml-getting-started.kuml.kts(C4,需 import)、docs/diagram-types.adoc
 *     (状态/用例/组件/部署/活动图);数据测试以「调用白名单」哨兵固化,
 *     禁止臆造其他 API。
 */

export interface CheatEntry {
  /** 全局唯一 id,同时用作复制按钮的状态 key。 */
  id: string
  /** 条目名(中文)。 */
  title: string
  /** 一句话说明(中文)。 */
  description: string
  /** 可照抄的语法示例。 */
  snippet: string
}

export interface CheatSection {
  id: string
  title: string
  entries: CheatEntry[]
}

export const cheatSections: CheatSection[] = [
  {
    id: 'markdown-basics',
    title: 'Markdown 基础',
    entries: [
      {
        id: 'md-heading',
        title: '标题',
        description: '# 的数量决定标题级别,共 1-6 级;# 与文字之间要有一个空格。',
        snippet: '# 一级标题\n## 二级标题\n### 三级标题',
      },
      {
        id: 'md-paragraph',
        title: '段落与换行',
        description: '空行分隔段落;同一段内想强制换行,在上一行行尾放两个空格。',
        snippet: '这是第一段。\n\n同一段内换行:上一行行尾有两个空格  \n这一行会紧贴上一行。',
      },
      {
        id: 'md-bold',
        title: '粗体',
        description: '用两个星号包裹要加粗的文字。',
        snippet: '**粗体文本**',
      },
      {
        id: 'md-italic',
        title: '斜体',
        description: '用一个星号包裹要倾斜的文字。',
        snippet: '*斜体文本*',
      },
      {
        id: 'md-bold-italic',
        title: '粗斜体',
        description: '三个星号包裹,粗体与斜体同时生效。',
        snippet: '***粗斜体文本***',
      },
      {
        id: 'md-inline-code',
        title: '行内代码',
        description: '用一对反引号包裹,内容以等宽字体显示且不做 Markdown 解析。',
        snippet: '`行内代码`',
      },
      {
        id: 'md-fenced-code',
        title: '围栏代码块',
        description: '三个反引号成对包裹,开头标注语言名可获得语法高亮。',
        snippet: '```js\nconsole.log("hello")\n```',
      },
      {
        id: 'md-quote',
        title: '引用',
        description: '行首加 > 即为引用块,可以连续多行。',
        snippet: '> 这是一段引用\n> 引用可以有多行',
      },
      {
        id: 'md-nested-quote',
        title: '多级引用',
        description: '每多一级加一个 >,引用内可继续嵌套列表、代码等其他元素。',
        snippet: '> 一级引用\n> > 二级引用\n> > > 三级引用',
      },
      {
        id: 'md-ul',
        title: '无序列表',
        description: '行首用 - 加空格;子级缩进两个空格。',
        snippet: '- 第一项\n- 第二项\n  - 嵌套项\n- 第三项',
      },
      {
        id: 'md-ol',
        title: '有序列表',
        description: '行首用数字加点加空格,序号会自动连续。',
        snippet: '1. 第一步\n2. 第二步\n3. 第三步',
      },
      {
        id: 'md-nested-list',
        title: '嵌套列表',
        description: '子级列表缩进两个空格;有序与无序可以互相嵌套。',
        snippet: '- 水果\n  - 苹果\n  - 橘子\n- 蔬菜\n  1. 白菜\n  2. 萝卜',
      },
      {
        id: 'md-link',
        title: '链接',
        description: '方括号写链接文字,圆括号写地址。',
        snippet: '[打开示例网站](https://example.com)',
      },
      {
        id: 'md-ref-link',
        title: '引用式链接',
        description: '同一链接多次出现时集中定义,正文保持干净;方括号别名与定义行成对使用。',
        snippet: '详情见 [GitHub][gh] 与 [Google][g]。\n\n[gh]: https://github.com\n[g]: https://google.com',
      },
      {
        id: 'md-image',
        title: '图片',
        description: '与链接写法相同,前面多一个感叹号;方括号内是加载失败时的替代文字。',
        snippet: '![图片描述](https://example.com/img.png)',
      },
      {
        id: 'md-hr',
        title: '分隔线',
        description: '单独一行写三个及以上的 - 或 *,上下各留空行。',
        snippet: '---',
      },
      {
        id: 'md-escape',
        title: '转义字符',
        description: '反斜杠让 Markdown 特殊字符按原样显示(* _ # ` 等)。',
        snippet: '\\*不是斜体\\*   \\# 不是标题   \\` 不是代码',
      },
      {
        id: 'md-indented-code',
        title: '缩进代码块',
        description: '每行前缩进 4 个空格即成代码块;日常写作更推荐围栏代码块,可标注语言且无需缩进。',
        snippet: '普通段落\n\n    这一行缩进了 4 个空格\n    会原样显示为代码',
      },
      {
        id: 'md-entities',
        title: '实体引用',
        description: 'HTML 实体可直接书写:&copy; 版权符号、&amp; 与符号、&lt; 小于号、&rarr; 右箭头。',
        snippet: '&copy; 2026   A &amp; B   a &lt; b   前进 &rarr;',
      },
      {
        id: 'md-double-backtick',
        title: '双反引号行内代码',
        description: '代码内容本身含反引号时,外层改用双反引号包裹;单反引号包不住内含反引号的内容。',
        snippet: '`` `code` `` 会原样显示出成对的反引号',
      },
      {
        id: 'md-closing-heading',
        title: '标题闭合',
        description: '标题可用若干 # 闭合,如 ## 标题 ##;闭合 # 前要有空格,且不会渲染出来。',
        snippet: '## 二级标题 ##\n### 三级标题 ###',
      },
      {
        id: 'md-backslash-break',
        title: '反斜杠硬换行',
        description: '行尾单个反斜杠与行尾两个空格等效,同样产生硬换行;反斜杠可见,比空格更好察觉。',
        snippet: '第一行行尾是反斜杠\\\n第二行紧贴上一行',
      },
    ],
  },
  {
    id: 'gfm-extended',
    title: 'GFM 扩展',
    entries: [
      {
        id: 'gfm-table',
        title: '表格',
        description: '第二行分隔行的每个列至少一个连字符(-),冒号位置控制该列对齐(:--- 左、:---: 中、---: 右)。',
        snippet: '| 姓名 | 数量 | 备注 |\n| --- | :---: | ---: |\n| 苹果 | 3 | 左对齐姓名 |\n| 香蕉 | 12 | 右对齐数量 |',
      },
      {
        id: 'gfm-task-list',
        title: '任务列表',
        description: '列表项后跟 [ ] 为未完成,[x] 为已完成,预览中渲染为可读的勾选框。',
        snippet: '- [ ] 写提纲\n- [x] 收集资料\n- [ ] 排版检查',
      },
      {
        id: 'gfm-strikethrough',
        title: '删除线',
        description: '用两个波浪线包裹要划掉的文字。',
        snippet: '~~被划掉的文字~~',
      },
      {
        id: 'gfm-autolink',
        title: '自动链接',
        description: '用尖括号包裹网址生成可点击链接。',
        snippet: '<https://example.com>',
      },
      {
        id: 'gfm-www',
        title: '裸网址',
        description: 'http(s):// 或 www. 开头的裸网址,不写尖括号也会自动变成链接。',
        snippet: '官网 https://example.com 与 www.example.com 都会自动变成链接',
      },
      {
        id: 'gfm-footnote',
        title: '脚注',
        description: '正文里用 [^名字] 标记,脚注内容单独一行写在文末。',
        snippet: '这里有一个脚注[^1]\n\n[^1]: 脚注内容写在文末',
      },
      {
        id: 'gfm-email-autolink',
        title: '邮箱自动链接',
        description: '尖括号包裹邮箱地址,渲染为可直接点击的 mailto 链接。',
        snippet: '反馈请发 <user@example.com>',
      },
      {
        id: 'gfm-table-inline',
        title: '表格单元格内联格式',
        description:
          '单元格内可继续使用 **粗体**、`代码`、[链接]() 等行内格式;内容本身含竖线时写成 &#124;,代码内的竖线则用 \\| 转义。',
        snippet:
          '| 命令 | 说明 |\n| --- | --- |\n| `npm test` | **运行测试**,详见 [文档](https://example.com) |\n| `a \\| b` | 竖线写成 &#124; |',
      },
    ],
  },
  {
    id: 'math',
    title: '数学(KaTeX)',
    entries: [
      {
        id: 'math-inline',
        title: '行内公式',
        description: '单个 $ 紧贴公式内容包裹,渲染在文字行内;勾选预览的公式开关后生效。',
        snippet: '质能方程 $E = mc^2$ 是物理学中最著名的公式。',
      },
      {
        id: 'math-block',
        title: '块级公式',
        description: '两个 $$ 包裹并独占段落,公式居中单独显示。',
        snippet: '$$\n\\int_0^1 x^2 \\, dx = \\frac{1}{3}\n$$',
      },
      {
        id: 'math-sub-sup',
        title: '上标与下标',
        description: '^ 上标、_ 下标;多于一个字符要用 {} 包成一组。',
        snippet: '$x^2$  $y_1$  $x^{2n}$  $a_{i,j}$',
      },
      {
        id: 'math-frac',
        title: '分数',
        description: '\\frac{分子}{分母};简单式子也可以直接用斜杠。',
        snippet: '$\\frac{a}{b}$  $\\frac{x+1}{x-1}$',
      },
      {
        id: 'math-sqrt',
        title: '根号',
        description: '\\sqrt{被开方数};方根用可选参数 [n]。',
        snippet: '$\\sqrt{2}$  $\\sqrt[3]{x}$',
      },
      {
        id: 'math-calculus',
        title: '求和、积分与极限',
        description: '上下限用 _ 与 ^ 跟在命令后;\\to 是箭头。',
        snippet: '$$\\sum_{i=1}^{n} a_i \\quad \\int_0^1 f(x)\\,dx \\quad \\lim_{x \\to 0} \\frac{\\sin x}{x}$$',
      },
      {
        id: 'math-greek',
        title: '希腊字母',
        description: '小写 \\alpha \\beta \\gamma,大写首字母大写 \\Omega \\Delta;变体加前缀 var。',
        snippet: '$\\alpha \\beta \\gamma \\delta \\theta \\lambda \\pi \\sigma$  $\\Omega \\Delta \\Gamma$',
      },
      {
        id: 'math-matrix',
        title: '矩阵',
        description: '& 分列、\\\\ 换行;pmatrix 圆括号、bmatrix 方括号、vmatrix 行列式。',
        snippet: '$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$',
      },
      {
        id: 'math-delimiters',
        title: '自适应定界符',
        description: '\\left 与 \\right 成对包裹,括号随内容自动变高。',
        snippet: '$$\\left(\\frac{a}{b}\\right) \\quad \\left[\\sum_i a_i\\right]$$',
      },
      {
        id: 'math-aligned',
        title: '多行对齐推导',
        description: 'aligned 环境,& 标记对齐点,\\\\ 换行,常用于等式推导。',
        snippet: '$$\\begin{aligned} f(x) &= x^2 + 2x + 1 \\\\ &= (x+1)^2 \\end{aligned}$$',
      },
      {
        id: 'math-cases',
        title: '方程组 / 分段函数',
        description: 'cases 环境按花括号分组,每行一个条件。',
        snippet: '$$f(x)=\\begin{cases} x^2 & x \\ge 0 \\\\ -x & x < 0 \\end{cases}$$',
      },
      {
        id: 'math-text',
        title: '公式中的文字',
        description: '\\text{...} 在公式里插入正体文字,中文也可用。',
        snippet: '$\\text{速度} = \\frac{\\text{路程}}{\\text{时间}}$',
      },
      {
        id: 'math-operators',
        title: '运算符',
        description: '乘除、加减号、点乘与张量积等运算符用专用命令,渲染出的间距更规范。',
        snippet: '$\\times \\div \\pm \\mp$  $\\cdot \\circ \\ast \\star$  $\\otimes \\oplus$',
      },
      {
        id: 'math-relations',
        title: '关系符',
        description: '不等、约等、同余、正比等关系符都有专用命令,不要用文本字符凑。',
        snippet: '$\\ne \\le \\ge$  $\\ll \\gg \\approx$  $\\equiv \\sim \\propto \\cong$',
      },
      {
        id: 'math-arrows',
        title: '箭头',
        description: '单线与双线箭头成对出现;\\mapsto 表示「映到」,\\hookrightarrow 是带钩嵌入箭头。',
        snippet: '$\\rightarrow \\leftarrow$  $\\Rightarrow \\Leftarrow \\Leftrightarrow$  $\\mapsto \\hookrightarrow$',
      },
      {
        id: 'math-logic-sets',
        title: '逻辑与集合',
        description: '量词、逻辑连接词与集合关系、集合运算符号。',
        snippet: '$\\forall \\exists \\neg \\land \\lor$  $\\in \\notin \\subset \\subseteq$  $\\cup \\cap \\emptyset \\setminus$',
      },
      {
        id: 'math-calculus-symbols',
        title: '微积分与物理常用符号',
        description: '无穷、偏微分、梯度算子与物理常用字母。',
        snippet: '$\\infty \\partial \\nabla$  $\\hbar \\ell$  $\\Re \\Im \\aleph$',
      },
      {
        id: 'math-big-operators',
        title: '大运算符',
        description: '求积与并、交、直和等大运算符,块级公式中上下限自动置于符号正上下方。',
        snippet:
          '$$\\prod_{i=1}^{n} a_i \\quad \\coprod_{i=1}^{n} a_i$$\n$$\\bigcup_{k=1}^{n} U_k \\quad \\bigcap_{k=1}^{n} U_k$$\n$$\\bigoplus_{k=1}^{n} V_k \\quad \\bigotimes_{k=1}^{n} V_k$$',
      },
      {
        id: 'math-integrals',
        title: '积分族',
        description: '二重、三重与环路积分,上下限写法与单积分一致。',
        snippet: '$$\\iint_D f\\,dA \\quad \\iiint_V f\\,dV \\quad \\oint_C \\vec{F} \\cdot d\\vec{r}$$',
      },
      {
        id: 'math-binomial',
        title: '二项式与组合数',
        description: '\\binom{n}{k} 随环境自适应大小;\\tbinom 文字尺寸、\\dbinom 显示尺寸。',
        snippet: '$\\binom{n}{k}$  $\\tbinom{n}{k}$  $\\dbinom{n}{k}$',
      },
      {
        id: 'math-over-under',
        title: '上下放置',
        description: '\\overset 把内容放到符号上方、\\underset 放到下方;\\stackrel 常用于在箭头上标注条件。',
        snippet: '$\\overset{\\text{def}}{=} x$  $\\underset{x \\to 0}{\\lim} f(x)$  $A \\stackrel{f}{\\rightarrow} B$',
      },
      {
        id: 'math-ext-arrows',
        title: '可延伸箭头标注',
        description: '\\xrightarrow / \\xleftarrow 的箭杆随上方文字自动加长,可选参数 [ ] 写下方标注。',
        snippet: '$A \\xrightarrow{n} B$  $C \\xleftarrow[m]{n} D$',
      },
      {
        id: 'math-accents',
        title: '重音装饰',
        description: '单字符重音用 \\hat \\bar \\vec \\dot \\ddot \\tilde;跨多字符用 \\widehat \\overline \\underline。',
        snippet: '$\\hat x \\bar x \\vec x$  $\\dot x \\ddot x \\tilde x$  $\\widehat{ABC} \\overline{AB} \\underline{AB}$',
      },
      {
        id: 'math-braces',
        title: '花括号结构',
        description: '\\overbrace 在内容上方画大括号并用 ^ 加说明,\\underbrace 在下方画并用 _ 加说明。',
        snippet: '$$\\overbrace{a+b+c}^{\\text{和}} \\qquad \\underbrace{a+b+c}_{\\text{三项}}$$',
      },
      {
        id: 'math-fonts',
        title: '字体族',
        description:
          '字体族命令切换字母风格:\\mathrm 正体、\\mathbf 粗体、\\mathbb 空心、\\mathcal 花体、\\mathfrak 哥特体等。',
        snippet: '$\\mathrm{d}x \\quad \\mathbf{v} \\mathit{xy}$  $\\mathbb{R} \\mathcal{L} \\mathfrak{g}$  $\\mathsf{s} \\mathtt{t}$',
      },
      {
        id: 'math-color',
        title: '颜色',
        description: '\\textcolor{颜色}{内容} 只给指定内容上色,\\color{颜色} 使其后内容全部变色。',
        snippet: '$\\textcolor{red}{x} + \\textcolor{blue}{y}$  {\\color{green} z = w}',
      },
      {
        id: 'math-spacing',
        title: '间距与省略号',
        description:
          '\\quad \\qquad 是大间距,\\, \\: \\; 由小到大;省略号 \\cdots 居中、\\ldots 靠底、\\vdots 竖排、\\ddots 斜排。',
        snippet: '$a \\, b \\: c \\; d \\quad e \\qquad f$  $\\cdots \\ldots \\vdots \\ddots$',
      },
      {
        id: 'math-mod-norm',
        title: '模与范数',
        description:
          '\\bmod 余数算符、\\pmod{n} 带括号同余;\\lVert \\rVert 范数、\\langle \\rangle 内积、\\lvert \\rvert 绝对值。',
        snippet: '$a \\bmod n$  $x \\equiv y \\pmod{n}$  $\\lVert x \\rVert \\quad \\langle x, y \\rangle \\quad \\lvert x \\rvert$',
      },
    ],
  },
  {
    id: 'mermaid',
    title: 'mermaid 图表',
    entries: [
      {
        id: 'mermaid-flowchart',
        title: '流程图',
        description: '用 ```mermaid 围栏包裹;TD 自上而下,[ ] 矩形、{ } 菱形判断,-->|文字| 是带标签的箭头。',
        snippet: '```mermaid\nflowchart TD\n    A[开始] --> B{判断}\n    B -->|是| C[结束]\n    B -->|否| A\n```',
      },
      {
        id: 'mermaid-sequence',
        title: '时序图',
        description: 'participant 声明参与者;->> 实线箭头发请求,-->> 虚线箭头回响应。',
        snippet: '```mermaid\nsequenceDiagram\n    participant U as 用户\n    participant S as 服务\n    U->>S: 请求\n    S-->>U: 响应\n```',
      },
      {
        id: 'mermaid-class',
        title: '类图',
        description: 'class 块内列成员,+ 公有 - 私有;<|-- 表示继承箭头。',
        snippet: '```mermaid\nclassDiagram\n    class Animal {\n        +String name\n        +eat()\n    }\n    class Dog\n    Animal <|-- Dog\n```',
      },
      {
        id: 'mermaid-state',
        title: '状态图',
        description: 'stateDiagram-v2 声明;[*] 是开始/结束伪状态,冒号后写转换条件。',
        snippet: '```mermaid\nstateDiagram-v2\n    [*] --> 待处理\n    待处理 --> 处理中: 开始\n    处理中 --> 已完成: 提交\n    已完成 --> [*]\n```',
      },
      {
        id: 'mermaid-er',
        title: 'ER 图',
        description: '实体间用「基数—关系—基数」连线:|| 恰一、o{ 零或多、|{ 一或多,冒号后是关系名。',
        snippet: '```mermaid\nerDiagram\n    CUSTOMER ||--o{ ORDER : places\n    ORDER ||--|{ LINE_ITEM : contains\n```',
      },
      {
        id: 'mermaid-pie',
        title: '饼图',
        description: 'pie title 设标题;每行「标签 : 数值」,占比自动计算。',
        snippet: '```mermaid\npie title 语言分布\n    "TypeScript" : 55\n    "Rust" : 30\n    "其他" : 15\n```',
      },
      {
        id: 'mermaid-gantt',
        title: '甘特图',
        description: 'dateFormat 定义日期格式;section 分组,任务用「名称 :id, 起始, 时长」声明,after id 表示接着前序任务。',
        snippet: '```mermaid\ngantt\n    title 项目排期\n    dateFormat YYYY-MM-DD\n    section 设计\n    原型设计 :a1, 2026-10-01, 7d\n    section 开发\n    编码实现 :a2, after a1, 14d\n```',
      },
      {
        id: 'mermaid-mindmap',
        title: '思维导图',
        description: '纯缩进表达层级;root((文字)) 是中心圆形节点,节点形状另支持 [方形]、{{六边形}} 等。',
        snippet: '```mermaid\nmindmap\n  root((Markdown))\n    基础语法\n      标题\n      列表\n    扩展\n      图表\n      公式\n```',
      },
      {
        id: 'mermaid-journey',
        title: '旅程图',
        description: 'journey 按 section 分组,每行「任务: 满意度: 参与者」,满意度 0-5,冒号后可列多个参与者。',
        snippet:
          '```mermaid\njourney\n    title 写作旅程\n    section 打开文档\n      启动应用: 5: 用户\n      打开文件: 4: 用户, 编辑器\n    section 编辑保存\n      编写内容: 3: 用户\n      自动保存: 5: 编辑器\n```',
      },
      {
        id: 'mermaid-quadrant',
        title: '象限图',
        description:
          'quadrantChart 定义 x/y 轴与四个象限(1 右上、2 左上、3 左下、4 右下),数据点写「名称: [x, y]」;轴、象限与数据点等中文文本必须用引号包裹。',
        snippet:
          '```mermaid\nquadrantChart\n    title "功能优先级"\n    x-axis "低紧急" --> "高紧急"\n    y-axis "低重要" --> "高重要"\n    quadrant-1 "立即做"\n    quadrant-2 "计划做"\n    quadrant-3 "少做"\n    quadrant-4 "委托做"\n    "语法速查": [0.3, 0.6]\n    "图表渲染": [0.8, 0.9]\n```',
      },
      {
        id: 'mermaid-requirement',
        title: '需求图',
        description:
          'requirement 块声明 id/text/risk/verifymethod,element 声明被测对象,「元素 - satisfies -> 需求」表达满足关系;text 等文本值用引号包裹。',
        snippet:
          '```mermaid\nrequirementDiagram\n    requirement req_login {\n        id: 1\n        text: "用户可以登录系统"\n        risk: low\n        verifymethod: inspection\n    }\n    element login_page {\n        type: "页面"\n    }\n    login_page - satisfies -> req_login\n```',
      },
      {
        id: 'mermaid-gitgraph',
        title: 'Git 提交图',
        description:
          'gitGraph 用 commit / branch / checkout / merge 演示分支模型;合并前先 checkout 目标分支,commit 可用 id 加注说明。',
        snippet:
          '```mermaid\ngitGraph\n    commit id: "init"\n    branch develop\n    checkout develop\n    commit id: "feat"\n    checkout main\n    merge develop\n    commit id: "release"\n```',
      },
      {
        id: 'mermaid-timeline',
        title: '时间线',
        description: 'timeline 按 section 分组,每行「时期 : 事件1 : 事件2」纵向铺开,冒号两侧留空格。',
        snippet:
          '```mermaid\ntimeline\n    title 项目里程碑\n    section 2026 年\n        10 月 : 需求确认 : 骨架搭建\n        11 月 : 功能填充\n    section 2027 年\n        1 月 : 正式发布\n```',
      },
      {
        id: 'mermaid-c4',
        title: 'C4 上下文图',
        description: 'C4Context 用 Person / System 声明角色与系统,Rel 建立关系;括号内依次是别名、显示名、描述。',
        snippet:
          '```mermaid\nC4Context\n    title 系统上下文\n    Person(customer, "客户", "使用编辑器的人")\n    System(editor, "Markdown 编辑器", "本地优先的写作工具")\n    Rel(customer, editor, "撰写文档")\n```',
      },
      {
        id: 'mermaid-sankey',
        title: '桑基图(beta)',
        description: 'sankey-beta 每行「源,目标,数值」构成一条流量,同名节点自动合并;属 beta 渲染器,可定制样式有限。',
        snippet: '```mermaid\nsankey-beta\nMarkdown,mermaid,5\nMarkdown,KaTeX,3\nPlantUML,kUML,2\n```',
      },
      {
        id: 'mermaid-xychart',
        title: '柱状 / 折线图(beta)',
        description: 'xychart-beta 先声明 x 轴类目与 y 轴范围,再用 bar 画柱状系列(line 画折线);类目文本用引号包裹。',
        snippet:
          '```mermaid\nxychart-beta\n    title "每周提交数"\n    x-axis ["周一", "周二", "周三", "周四", "周五"]\n    y-axis "提交数" 0 --> 20\n    bar [5, 9, 7, 12, 4]\n```',
      },
    ],
  },
  {
    id: 'plantuml',
    title: 'PlantUML',
    entries: [
      {
        id: 'puml-sequence',
        title: '时序图',
        description: '@startuml 与 @enduml 成对包裹;-> 实线同步消息,--> 虚线返回消息。',
        snippet: '@startuml\nA -> B: 消息\nB --> A: 响应\n@enduml',
      },
      {
        id: 'puml-class',
        title: '类图',
        description: 'class 块内直接列属性与方法,+ 公有 - 私有;*-- 表示组合关系。',
        snippet: '@startuml\nclass Car {\n  +drive(): void\n  -engine: Engine\n}\nCar *-- Engine\n@enduml',
      },
      {
        id: 'puml-usecase',
        title: '用例图',
        description: 'actor 声明参与者,usecase 声明用例,箭头表示参与关系。',
        snippet: '@startuml\nactor 用户\nusecase "打开文件" as UC1\n用户 --> UC1\n@enduml',
      },
      {
        id: 'puml-activity',
        title: '活动图 / 流程',
        description: 'start/stop 定界;动作行以冒号开头分号结尾;if () then () 做分支,else 兜底,endif 收口。',
        snippet: '@startuml\nstart\n:接收请求;\nif (校验通过?) then (是)\n  :处理业务;\nelse (否)\n  :返回错误;\nendif\nstop\n@enduml',
      },
      {
        id: 'puml-state',
        title: '状态图',
        description: '[*] 是开始/结束伪状态,箭头标签写触发事件。',
        snippet: '@startuml\n[*] --> 空闲\n空闲 --> 运行 : 启动\n运行 --> 空闲 : 停止\n运行 --> [*]\n@enduml',
      },
      {
        id: 'puml-note',
        title: '注释',
        description: 'note left/right of 参与者,多行内容以 end note 收口;over 表示横跨。',
        snippet: '@startuml\nA -> B: 请求\nnote right of B\n  处理前先做鉴权\nend note\n@enduml',
      },
      {
        id: 'puml-activate',
        title: '生命线激活',
        description: 'activate / deactivate 在时序图上表达「处理中」的激活粗条。',
        snippet: '@startuml\nA -> B: 请求\nactivate B\nB -> B: 内部处理\nB --> A: 响应\ndeactivate B\n@enduml',
      },
      {
        id: 'puml-object',
        title: '对象图',
        description: 'object 声明对象实例并直接列字段,对象之间用箭头表达指向关系。',
        snippet: '@startuml\nobject 用户 {\n  name: String\n}\nobject 订单\n用户 --> 订单\n@enduml',
      },
      {
        id: 'puml-component',
        title: '组件图',
        description: 'package 分层收纳 component 与 interface,..> 是依赖方向的虚线箭头。',
        snippet:
          '@startuml\npackage "分层" {\n  component "Web UI"\n  interface "API"\n  component "服务"\n}\n"Web UI" ..> "API"\n"API" ..> "服务"\n@enduml',
      },
      {
        id: 'puml-deployment',
        title: '部署图',
        description: 'node 可层层嵌套表达部署层级,最内层放 artifact 制品;cloud 表示外部云服务。',
        snippet: '@startuml\nnode "云" {\n  node "服务器" {\n    artifact app.jar\n  }\n}\ncloud "对象存储"\n@enduml',
      },
      {
        id: 'puml-wbs',
        title: 'WBS 工作分解',
        description: '@startwbs / @endwbs 专用围栏;* 是根节点,星号逐层加一个表示下一级,同级星号数相同。',
        snippet: '@startwbs\n* 项目\n** 需求\n** 开发\n*** 前端\n*** 后端\n** 测试\n@endwbs',
      },
      {
        id: 'puml-gantt',
        title: '甘特图',
        description:
          '@startgantt 中 [任务] lasts N days 声明耗时,then 表示接续上一任务,-- 文字 -- 作分组分隔线,happens at 指定里程碑时点。',
        snippet:
          '@startgantt\n[设计] lasts 10 days\nthen [开发] lasts 14 days\n-- 里程碑 --\n[发布] happens at [开发]\'s end\n@endgantt',
      },
      {
        id: 'puml-mindmap',
        title: '思维导图',
        description: '@startmindmap / @endmindmap 专用围栏;* 根节点,星号逐层加深;分支默认画在右侧,left side 行之后画在左侧;节点加 _(如 **_)为无边框样式。',
        snippet: '@startmindmap\n* Markdown\n** 基础\n*** 标题\n*** 列表\nleft side\n** 设计\n**_ 图标\n@endmindmap',
      },
    ],
  },
  {
    id: 'kuml',
    title: 'kUML',
    entries: [
      {
        id: 'kuml-class',
        title: '类图基础',
        description:
          'Kotlin DSL 声明类、属性(attribute)、操作(operation),association 连接关系;渲染需本机安装 kuml CLI(choco install kuml),未装时预览保留源码。',
        snippet:
          'classDiagram(name = "Order Domain") {\n    val order = classOf(name = "Order") {\n        attribute(name = "id", type = "UUID")\n        operation(name = "confirm")\n    }\n    val item = classOf(name = "Item") {\n        attribute(name = "qty", type = "Int")\n    }\n    association(source = order, target = item)\n}',
      },
      {
        id: 'kuml-enum',
        title: '枚举',
        description:
          'enumOf + literal 声明枚举字面量,枚举值可直接作为属性类型引用;渲染需本机安装 kuml CLI(choco install kuml),未装时预览保留源码。',
        snippet:
          'classDiagram(name = "Demo") {\n    val status = enumOf(name = "OrderStatus") {\n        literal(name = "DRAFT")\n        literal(name = "SHIPPED")\n    }\n    val order = classOf(name = "Order") {\n        attribute(name = "status", type = status)\n    }\n}',
      },
      {
        id: 'kuml-association',
        title: '关联修饰(多重性 / 聚合)',
        description:
          'association 块内设置聚合类型与两端多重性(spec)、role 角色名;与类图基础一样无需 import。渲染需本机安装 kuml CLI(choco install kuml),未装时预览保留源码。',
        snippet:
          'classDiagram(name = "Order Domain") {\n    val order = classOf(name = "Order") {\n        attribute(name = "id", type = "UUID")\n    }\n    val orderItem = classOf(name = "OrderItem") {\n        attribute(name = "qty", type = "Int")\n    }\n    association(source = order, target = orderItem) {\n        aggregation = AggregationKind.COMPOSITE\n        source { multiplicity(spec = "1") }\n        target { multiplicity(spec = "1..*"); role = "items" }\n    }\n}',
      },
      {
        id: 'kuml-sequence',
        title: '时序图',
        description:
          'sequenceDiagram 内 lifeline 声明生命线,message / reply 表达消息与回复;无需 import(官方 LLM 页示例)。渲染需本机安装 kuml CLI(choco install kuml),未装时预览保留源码。',
        snippet:
          'sequenceDiagram(name = "Payment Flow") {\n    val customer = lifeline(name = "Customer")\n    val gateway = lifeline(name = "API Gateway")\n    val payments = lifeline(name = "Payment Service")\n    val ledger = lifeline(name = "Ledger")\n\n    message(from = customer, to = gateway, label = "POST /pay")\n    message(from = gateway, to = payments, label = "processPayment(order)")\n    reply(from = ledger, to = payments, label = "ok")\n}',
      },
      {
        id: 'kuml-c4',
        title: 'C4 系统上下文图',
        description:
          'C4 构造需要第一行 import;c4Model 内声明 person / softwareSystem 并用 relationship 连接,systemContextDiagram 的 include 选择入图元素(官方示例)。渲染需本机安装 kuml CLI(choco install kuml),未装时预览保留源码。',
        snippet:
          'import dev.kuml.c4.dsl.*\n\nc4Model(name = "Shop") {\n    val customer = person(name = "Customer") {\n        description = "A shopper"\n    }\n    val shop = softwareSystem(name = "Shop System") {\n        description = "Lets customers browse and order"\n    }\n    relationship(source = customer, target = shop) { technology = "HTTPS" }\n\n    systemContextDiagram(name = "Shop — System Context") {\n        include(customer, shop)\n    }\n}',
      },
      {
        id: 'kuml-state',
        title: '状态图',
        description:
          'stateDiagram 内 state 声明状态,initial() / final() 是起止伪状态,goesTo 中缀连接并可用 on "事件" 标注触发(docs/diagram-types.adoc)。渲染需本机安装 kuml CLI(choco install kuml),未装时预览保留源码。',
        snippet:
          'stateDiagram(name = "Order Lifecycle") {\n    val draft = state(name = "Draft")\n    val placed = state(name = "Placed")\n    val shipped = state(name = "Shipped")\n    initial() goesTo draft\n    draft goesTo placed on "submit"\n    placed goesTo shipped on "ship"\n    shipped goesTo final()\n}',
      },
      {
        id: 'kuml-usecase',
        title: '用例图',
        description:
          'useCaseDiagram 内 actor 与 useCase 声明参与者与用例,associates 表达参与关系,includes 表达用例包含(docs/diagram-types.adoc)。渲染需本机安装 kuml CLI(choco install kuml),未装时预览保留源码。',
        snippet:
          'useCaseDiagram(name = "Checkout") {\n    val customer = actor(name = "Customer")\n    val browse = useCase(name = "Browse Catalog")\n    val checkout = useCase(name = "Place Order")\n    val pay = useCase(name = "Pay")\n    customer associates browse\n    customer associates checkout\n    checkout includes pay\n}',
      },
      {
        id: 'kuml-component',
        title: '组件图',
        description:
          'componentDiagram 内 component 声明组件,dependsOn 中缀表达依赖方向,前者依赖后者(docs/diagram-types.adoc)。渲染需本机安装 kuml CLI(choco install kuml),未装时预览保留源码。',
        snippet:
          'componentDiagram(name = "Architecture") {\n    val web = component(name = "Web UI")\n    val api = component(name = "API Gateway")\n    val orders = component(name = "Orders Service")\n    web dependsOn api\n    api dependsOn orders\n}',
      },
      {
        id: 'kuml-deployment',
        title: '部署图',
        description:
          'deploymentDiagram 内 executionEnvironment / node / artifact 表达部署层级,device 是独立设备,communicationPath 连接两个部署端(docs/diagram-types.adoc)。渲染需本机安装 kuml CLI(choco install kuml),未装时预览保留源码。',
        snippet:
          'deploymentDiagram(name = "AWS — production") {\n    val vpc = executionEnvironment(name = "VPC eu-central-1") {\n        node(name = "EKS Cluster") {\n            artifact(name = "kuml-web.jar")\n        }\n    }\n    val db = device(name = "RDS PostgreSQL")\n    communicationPath(end1 = vpc, end2 = db)\n}',
      },
      {
        id: 'kuml-activity',
        title: '活动图',
        description:
          'activityDiagram 内 initialNode / action / decision / finalNode 声明节点,edge(from, to) 依次连边,guard 参数标注分支条件(docs/diagram-types.adoc)。渲染需本机安装 kuml CLI(choco install kuml),未装时预览保留源码。',
        snippet:
          'activityDiagram(name = "Order checkout") {\n    val start = initialNode()\n    val validate = action(name = "Validate cart")\n    val ok = decision(name = "valid?")\n    val charge = action(name = "Charge card")\n    val end = finalNode()\n    edge(from = start, to = validate)\n    edge(from = validate, to = ok)\n    edge(from = ok, to = charge, guard = "valid")\n    edge(from = charge, to = end)\n}',
      },
    ],
  },
]
