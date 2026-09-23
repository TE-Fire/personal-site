# Vue 3 Class 与 Style 绑定 · 快速入门

> 本文精简自 [Vue 3 官方文档 - Class 与 Style 绑定](https://cn.vuejs.org/guide/essentials/class-and-style.html)，兼顾底层原理与实战写法，适合快速上手。

---

## 一、概述

`class` 和 `style` 本质上都是 HTML attribute，本可以用 `v-bind` 绑定字符串。但拼接字符串既麻烦又易错：

```html
<!-- ❌ 字符串拼接，繁琐且易错 -->
<div :class="'static ' + (isActive ? 'active' : '') + ' ' + (hasError ? 'text-danger' : '')"></div>
```

因此 Vue 为 `:class` 和 `:style` 提供了**特殊增强**：表达式的值除了字符串，还可以是**对象或数组**，让动态 class/style 的声明更清晰。

---

## 二、绑定 HTML class

### 1. 对象语法

`:class` 接收对象，键为 class 名，值为布尔表达式（真值则包含该 class）：

```html
<div :class="{ active: isActive }"></div>
```

多个 class 可同时写，且能与普通 `class` 共存：

```js
const isActive = ref(true)
const hasError = ref(false)
```

```html
<div
  class="static"
  :class="{ active: isActive, 'text-danger': hasError }"
></div>
```

渲染结果：`<div class="static active"></div>`

当 `hasError` 变为 `true`，自动变为 `class="static active text-danger"`。

#### 绑定对象变量或计算属性

```js
// 直接绑定对象
const classObject = reactive({ active: true, 'text-danger': false })

// 或绑定返回对象的计算属性
const classObject = computed(() => ({
  active: isActive.value && !error.value,
  'text-danger': error.value?.type === 'fatal'
}))
```

```html
<div :class="classObject"></div>
```

### 2. 数组语法

`:class` 接收数组，渲染多个 class：

```js
const activeClass = ref('active')
const errorClass = ref('text-danger')
```

```html
<div :class="[activeClass, errorClass]"></div>
<!-- 渲染：class="active text-danger" -->
```

#### 数组中条件 class

用三元表达式：

```html
<div :class="[isActive ? activeClass : '', errorClass]"></div>
```

或在数组中嵌套对象（多条件时更清晰）：

```html
<div :class="[{ [activeClass]: isActive }, errorClass]"></div>
```

### 3. 在组件上使用

**单根组件**：传入的 class 会自动合并到根元素已有 class 上。

```html
<!-- 子组件模板 -->
<p class="foo bar">Hi!</p>

<!-- 使用时 -->
<MyComponent class="baz boo" />
<!-- 渲染：<p class="foo bar baz boo">Hi!</p> -->
```

`:class` 同样适用：

```html
<MyComponent :class="{ active: isActive }" />
```

**多根组件**：需用 `$attrs.class` 指定接收元素：

```html
<!-- 子组件 -->
<p :class="$attrs.class">Hi!</p>
<span>This is a child component</span>
```

---

## 三、绑定内联样式 `:style`

### 1. 对象语法

`:style` 接收 JS 对象，键为 CSS 属性名（推荐 camelCase）：

```js
const activeColor = ref('red')
const fontSize = ref(30)
```

```html
<div :style="{ color: activeColor, fontSize: fontSize + 'px' }"></div>
```

也支持 kebab-case（需加引号）：

```html
<div :style="{ 'font-size': fontSize + 'px' }"></div>
```

直接绑定样式对象或计算属性更简洁：

```js
const styleObject = reactive({ color: 'red', fontSize: '30px' })
```

```html
<div :style="styleObject"></div>
```

`:style` 可与普通 `style` attribute 共存，最终合并：

```html
<h1 style="color: red" :style="'font-size: 1em'">hello</h1>
<!-- 渲染：style="color: red; font-size: 1em;" -->
```

### 2. 数组语法

绑定多个样式对象，按顺序合并（后者覆盖前者）：

```html
<div :style="[baseStyles, overridingStyles]"></div>
```

### 3. 自动前缀

使用需要浏览器前缀的 CSS 属性时，Vue 在运行时检测浏览器支持情况，自动添加正确前缀。

### 4. 样式多值

为一个属性提供多个候选值，Vue 只渲染浏览器支持的最后一个：

```html
<div :style="{ display: ['-webkit-box', '-ms-flexbox', 'flex'] }"></div>
<!-- 支持 flex 的浏览器最终渲染：display: flex -->
```

---

## 四、设计思想：为什么 class/style 需要特殊增强

### 痛点：字符串拼接的脆弱性

原生 `v-bind` 只能绑定字符串，动态 class 必须手动拼接：

```html
<!-- 痛点：引号嵌套、空格处理、条件判断全混在一起 -->
<div :class="'btn ' + (type === 'primary' ? 'btn-primary' : 'btn-default') + ' ' + (disabled ? 'disabled' : '')"></div>
```

问题：
- 引号嵌套容易写错
- 空格处理需小心翼翼（多一个少一个都出错）
- 条件 class 多时可读性极差

### 设计思路：声明式描述"最终状态"

Vue 的解法是让 `:class` / `:style` 接受**对象或数组**，让开发者描述"想要的结果"而非"如何拼接字符串"：

```
字符串拼接思路：   我要把这些片段拼起来 → 易错
对象/数组思路：    我要这些 class → 框架帮我合并 → 稳健
```

### 内部机制（伪代码）

```js
// 伪代码：:class 绑定的归一化逻辑
function normalizeClass(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    // 递归处理数组，过滤空值
    return value.map(normalizeClass).filter(Boolean).join(' ')
  }
  if (typeof value === 'object') {
    // 遍历对象，收集值为真的键
    return Object.keys(value)
      .filter(key => value[key])
      .join(' ')
  }
  return ''
}
```

### 设计收益

| 设计决策 | 解决的问题 |
|---------|-----------|
| 接受对象 `{ cls: bool }` | 条件 class 声明清晰，无需三元拼接 |
| 接受数组 `[a, b]` | 多 class 组合直观 |
| 与普通 `class` 共存 | 静态 class 和动态 class 分离，职责清晰 |
| `:style` 自动前缀 | 屏蔽浏览器差异，开发者无需关心 |
| `:style` 多值回退 | 渐进增强，自动选浏览器支持的值 |

> 💡 **一句话总结**：class/style 绑定的设计本质是**用声明式数据结构（对象/数组）替代命令式字符串拼接**，把"怎么拼"交给框架，开发者只需描述"要什么"。

---

## 五、速查表

| 场景 | 写法 | 渲染结果 |
|------|------|---------|
| 单个条件 class | `:class="{ active: isActive }"` | `class="active"` 或 `class=""` |
| 多条件 class | `:class="{ a: ok, b: !ok }"` | 根据布尔值组合 |
| 静态 + 动态 | `class="s" :class="{ a: ok }"` | `class="s a"` |
| 数组多 class | `:class="[a, b]"` | `class="a b"` |
| 数组条件 | `:class="[ok ? a : '', b]"` | 条件包含 a |
| 数组嵌套对象 | `:class="[{ a: ok }, b]"` | 多条件更清晰 |
| 内联样式对象 | `:style="{ color: c, fontSize: s }"` | `style="color: ...; font-size: ..."` |
| 样式数组合并 | `:style="[base, override]"` | 后者覆盖前者 |
| 样式多值回退 | `:style="{ display: ['-webkit-box', 'flex'] }"` | 渲染支持的最后一个 |

---

## 六、核心原则总结

1. **用对象/数组替代字符串拼接**：`:class` 和 `:style` 接受对象或数组，声明式描述目标状态
2. **静态与动态分离**：静态 class 用普通 `class`，动态部分用 `:class`，两者自动合并
3. **对象语法适合条件切换**：`{ cls: 条件 }` 是最常用的条件 class 写法
4. **数组语法适合多 class 组合**：多个 class 同时存在或条件组合时使用
5. **`:style` 自动处理前缀和多值**：无需手动加浏览器前缀，提供多值自动回退
6. **组件上的 class 自动合并到根元素**：多根组件需用 `$attrs.class` 指定接收元素
