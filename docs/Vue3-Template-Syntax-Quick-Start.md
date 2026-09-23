# Vue 3 模板语法 · 快速入门

> 本文精简自 [Vue 3 官方文档 - 模板语法](https://cn.vuejs.org/guide/essentials/template-syntax.html)，聚焦核心语法与常用写法，适合快速上手。

---

## 一、概述

Vue 使用**基于 HTML 的模板语法**，声明式地将组件数据绑定到 DOM。

- 所有 Vue 模板都是合法的 HTML
- 底层会编译成高度优化的 JavaScript 代码
- 结合响应式系统，状态变更时智能执行最少的 DOM 操作

> 💡 若熟悉虚拟 DOM 且偏好手写 JS，可使用 JSX / 渲染函数，但无法享受模板级别的编译时优化。

---

## 二、文本插值 `{{ }}`

最基本的数据绑定，使用 **Mustache 语法**（双大括号）：

```html
<span>Message: {{ msg }}</span>
```

- 标签会被替换为组件实例中 `msg` 属性的值
- `msg` 变化时自动同步更新

---

## 三、原始 HTML `v-html`

双大括号将数据解释为**纯文本**。若要插入 HTML，使用 `v-html` 指令：

```html
<p>文本插值：{{ rawHtml }}</p>
<p>v-html：<span v-html="rawHtml"></span></p>
```

- `span` 的内容被替换为 `rawHtml` 的值，作为**纯 HTML** 插入
- 数据绑定会被忽略，不能用 `v-html` 拼接组合模板

> ⚠️ **安全警告**：动态渲染任意 HTML 极易导致 XSS 漏洞。仅在内容可信时使用，**永远不要**渲染用户提供的 HTML。

---

## 四、Attribute 绑定 `v-bind`

双大括号不能用于 HTML attribute，需用 `v-bind` 指令：

```html
<div v-bind:id="dynamicId"></div>
```

- 绑定值为 `null` 或 `undefined` 时，该 attribute 会从元素上移除

### 简写 `:`

`v-bind` 非常常用，提供简写：

```html
<div :id="dynamicId"></div>
```

### 同名简写（Vue 3.4+）

attribute 名与绑定变量名相同时，可省略值：

```html
<!-- 等价于 :id="id" -->
<div :id></div>
```

### 布尔型 Attribute

布尔型 attribute（如 `disabled`）依据 true/false 决定是否存在：

```html
<button :disabled="isButtonDisabled">Button</button>
```

- 真值或空字符串 → 包含该 attribute
- 其他假值 → 忽略该 attribute

### 动态绑定多个值

通过不带参数的 `v-bind`，将对象的所有属性绑定到单个元素：

```js
const objectOfAttrs = { id: 'container', class: 'wrapper' }
```

```html
<div v-bind="objectOfAttrs"></div>
```

---

## 五、JavaScript 表达式

所有数据绑定都支持**完整的 JavaScript 表达式**：

```html
{{ number + 1 }}
{{ ok ? 'YES' : 'NO' }}
{{ message.split('').reverse().join('') }}
<div :id="`list-${id}`"></div>
```

可使用场景：
- 文本插值 `{{ }}` 内
- 任何 `v-` 指令的 attribute 值中

### 仅支持单一表达式

每个绑定仅支持**单一表达式**（可写在 `return` 后的代码），下面的写法无效：

```html
<!-- 语句而非表达式 -->
{{ var a = 1 }}

<!-- 条件控制不支持，用三元表达式 -->
{{ if (ok) { return message } }}
```

### 调用函数

可在表达式中使用组件暴露的方法：

```html
<time :title="toTitleDate(date)" :datetime="date">
  {{ formatDate(date) }}
</time>
```

> ⚠️ 绑定的方法在组件每次更新时都会重新调用，**不应产生副作用**（如改数据、触发异步操作）。

### 受限的全局访问

模板表达式被沙盒化，仅能访问有限的全局对象（如 `Math`、`Date`）。`window` 上的自定义属性无法直接访问，如需使用，可在 `app.config.globalProperties` 上显式添加。

---

## 六、指令 Directives

指令是带有 `v-` 前缀的特殊 attribute，任务是在表达式值变化时**响应式地更新 DOM**。

```html
<p v-if="seen">Now you see me</p>
```

### 指令语法结构

```
v-on:submit.prevent="onSubmit"
 │   │     │        │
 │   │     │        └─ 指令的值（JS 表达式）
 │   │     └─ 修饰符（. 开头）
 │   └─ 参数（: 后，可为动态 [arg]）
 └─ 指令名（v- 前缀）
```

### 参数 Arguments

指令名后用冒号分隔参数：

```html
<!-- v-bind 参数：attribute 名 -->
<a v-bind:href="url">...</a>
<a :href="url">...</a>          <!-- 简写 -->

<!-- v-on 参数：事件名 -->
<a v-on:click="doSomething">...</a>
<a @click="doSomething">...</a>  <!-- 简写 @ -->
```

### 动态参数

参数也可以是 JavaScript 表达式，用方括号包裹：

```html
<a :[attributeName]="url">...</a>
<a @[eventName]="doSomething">...</a>
```

- 表达式值应为**字符串**或 `null`（`null` 表示显式移除绑定）
- 不能包含空格和引号等 HTML attribute 名非法字符
- DOM 内嵌模板中避免使用大写字母（浏览器会强制转小写）；SFC 不受此限

### 修饰符 Modifiers

以 `.` 开头的特殊后缀，指示指令以特殊方式绑定：

```html
<form @submit.prevent="onSubmit">...</form>
<!-- .prevent 告知 v-on 调用 event.preventDefault() -->
```

---

## 七、速查表

| 语法 | 作用 | 简写 |
|------|------|------|
| `{{ msg }}` | 文本插值 | — |
| `v-html="rawHtml"` | 插入原始 HTML | — |
| `v-bind:id="x"` | 绑定 attribute | `:id="x"` |
| `v-bind="obj"` | 批量绑定对象属性 | — |
| `v-on:click="fn"` | 监听事件 | `@click="fn"` |
| `v-bind:[attr]="x"` | 动态 attribute | `:[attr]="x"` |
| `@submit.prevent` | 事件 + 修饰符 | — |
