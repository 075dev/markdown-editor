/**
 * 应用内语法速查面板(add-006)的内容数据。
 *
 * 设计要点:
 *   - 纯静态数据,打包内置,离线可用;不读文件、不发请求。
 *   - 六节与编辑器支持的语法域一一对应:Markdown 基础 / GFM 扩展 /
 *     数学(KaTeX) / mermaid / PlantUML / kUML。
 *   - snippet 是「用户可直接照抄进编辑器」的完整示例文本:
 *     围栏类示例(mermaid)自带 ``` 围栏;@startuml / Kotlin DSL 类
 *     示例是裸源码,由编辑器的图表识别逻辑接管。
 *   - kUML 节只用官方 README 验证过的构造(classOf/enumOf/attribute/
 *     operation/association/literal),禁止臆造其他 API。
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
        id: 'md-ul',
        title: '无序列表',
        description: '行首用 - 加空格;嵌套时缩进两个空格。',
        snippet: '- 第一项\n- 第二项\n  - 嵌套项\n- 第三项',
      },
      {
        id: 'md-ol',
        title: '有序列表',
        description: '行首用数字加点加空格,序号会自动连续。',
        snippet: '1. 第一步\n2. 第二步\n3. 第三步',
      },
      {
        id: 'md-link',
        title: '链接',
        description: '方括号写链接文字,圆括号写地址。',
        snippet: '[打开示例网站](https://example.com)',
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
        description: '用尖括号包裹网址生成可点击链接;裸网址通常也会被自动识别。',
        snippet: '<https://example.com>',
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
        id: 'math-commands',
        title: '常用命令',
        description: '反斜杠引导命令:\\frac 分数、\\sum 求和、\\sqrt 根号、\\alpha \\beta \\gamma 希腊字母。',
        snippet: '$\\frac{a}{b}$  $\\sum_{i=1}^{n} a_i$  $\\sqrt{x}$  $\\alpha \\beta \\gamma$',
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
        title: '枚举与组合',
        description:
          'enumOf + literal 声明枚举字面量,枚举值可直接作为属性类型引用;渲染需本机安装 kuml CLI(choco install kuml),未装时预览保留源码。',
        snippet:
          'classDiagram(name = "Demo") {\n    val status = enumOf(name = "OrderStatus") {\n        literal(name = "DRAFT")\n        literal(name = "SHIPPED")\n    }\n    val order = classOf(name = "Order") {\n        attribute(name = "status", type = status)\n    }\n}',
      },
    ],
  },
]
