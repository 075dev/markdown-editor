/**
 * 应用内语法速查面板(add-006,add-007 扩充)的内容数据。
 *
 * 设计要点:
 *   - 纯静态数据,打包内置,离线可用;不读文件、不发请求。
 *   - 六节与编辑器支持的语法域一一对应:Markdown 基础 / GFM 扩展 /
 *     数学(KaTeX) / mermaid / PlantUML / kUML,共 55 条。
 *   - 只收录编辑器渲染得出的语法(remark-gfm / KaTeX / mermaid 11 /
 *     PlantUML 标准集);渲染不出的一律不收(如 ==高亮==,remark-gfm 不支持)。
 *   - snippet 是「用户可直接照抄进编辑器」的完整示例文本:
 *     围栏类示例(mermaid)自带 ``` 围栏;@startuml / Kotlin DSL 类
 *     示例是裸源码,由编辑器的图表识别逻辑接管。
 *   - kUML 节只收官方验证构造,三来源:GitHub README Quick Start
 *     (类图/枚举/关联多重性聚合)、kuml.dev/llm(时序图)、官方 examples
 *     kuml-getting-started.kuml.kts(C4,需 import);数据测试以
 *     「调用白名单」哨兵固化,禁止臆造其他 API。
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
    ],
  },
]
