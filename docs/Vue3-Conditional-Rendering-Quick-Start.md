# Vue 3 条件渲染 · 快速入门

> 本文精简自 [Vue 3 官方文档 - 条件渲染](https://cn.vuejs.org/guide/essentials/conditional.html)，兼顾底层原理与实战写法，适合快速上手。

---

## 一、概述

条件渲染 = **根据数据决定 DOM 里渲染什么**。Vue 提供两个指令：

| 指令 | 机制 | 适用场景 |
|------|------|---------|
| `v-if` | 真实创建/销毁 DOM 元素 | 条件很少改变 |
| `v-show` | 始终保留 DOM，仅切换 `display: none` | 频繁切换显示/隐藏 |

---

## 二、v-if 系列

### 1. v-if

表达式返回真值时渲染，假值时不渲染（DOM 中不存在该元素）：

```html
<h1 v-if="awesome">Vue is awesome!</h1>
```

**使用场景**：登录后才显示用户面板，未登录则完全不渲染（DOM 中不存在该元素）：

```html
<div v-if="isLogin">
  <p>欢迎，{{ username }}</p>
  <button @click="logout">退出登录</button>
</div>
```

### 2. v-else

必须紧跟在 `v-if` 或 `v-else-if` 后面，否则不会被识别：

```html
<button @click="awesome = !awesome">Toggle</button>

<h1 v-if="awesome">Vue is awesome!</h1>
<h1 v-else>Oh no</h1>
```

**使用场景**：登录/未登录两态切换，点击按钮切换状态：

```html
<!-- 已登录显示用户名，未登录显示登录按钮 -->
<button v-if="isLogin">{{ username }}</button>
<button v-else>登录</button>
```

### 3. v-else-if

提供"else if"分支，可连续多次使用：

```html
<div v-if="type === 'A'">A</div>
<div v-else-if="type === 'B'">B</div>
<div v-else-if="type === 'C'">C</div>
<div v-else>Not A/B/C</div>
```

**使用场景**：根据订单状态显示不同文案：

```html
<span v-if="status === 'pending'">待付款</span>
<span v-else-if="status === 'paid'">已付款，待发货</span>
<span v-else-if="status === 'shipped'">已发货</span>
<span v-else>已完成</span>
```

### 4. 在 `<template>` 上使用 v-if

`v-if` 必须依附于某个元素。要切换多个元素时，用 `<template>` 包裹——它是一个**不可见包装器**，渲染结果中不包含 `<template>` 标签：

```html
<template v-if="ok">
  <h1>Title</h1>
  <p>Paragraph 1</p>
  <p>Paragraph 2</p>
</template>
```

`v-else` 和 `v-else-if` 也可在 `<template>` 上使用。

**使用场景**：编辑模式下整组表单字段才显示，查看模式下不渲染：

```html
<template v-if="isEditing">
  <input v-model="form.name" placeholder="姓名" />
  <input v-model="form.email" placeholder="邮箱" />
  <textarea v-model="form.bio" placeholder="简介"></textarea>
</template>
```

---

## 三、v-show

用法与 `v-if` 类似，但机制完全不同——元素**始终存在于 DOM 中**，仅切换 CSS `display` 属性：

```html
<h1 v-show="ok">Hello!</h1>
```

`ok` 为 `false` 时，渲染为：`<h1 style="display: none">Hello!</h1>`

限制：
- 不支持 `<template>` 元素
- 不能与 `v-else` 搭配使用

**使用场景**：标签页切换——用户频繁点击不同 tab，用 v-show 避免反复创建/销毁：

```html
<!-- 三个 tab 内容都渲染到 DOM，点击切换 display -->
<div v-show="activeTab === 'info'">基本信息</div>
<div v-show="activeTab === 'security'">安全设置</div>
<div v-show="activeTab === 'notify'">通知设置</div>
```

折叠面板、手风琴菜单、弹窗显隐等同理——频繁切换的场景首选 v-show。

---

## 四、v-if vs v-show（核心对比）

| 对比维度 | `v-if` | `v-show` |
|---------|--------|----------|
| **DOM 存在性** | 条件为假时元素不在 DOM 中 | 元素始终在 DOM 中 |
| **切换机制** | 创建/销毁元素及其事件监听器、子组件 | 仅切换 `display: none` |
| **初始渲染** | 惰性：初始为假则不渲染 | 无论初始条件如何都渲染 |
| **切换开销** | 高（销毁+重建） | 低（改 CSS） |
| **初始渲染开销** | 低（条件为假时零开销） | 高（始终渲染） |
| **适用场景** | 条件很少改变 | 频繁切换显示/隐藏 |

### 选择建议

```
频繁切换 → v-show（改 CSS，切换快）
很少改变  → v-if（不渲染，省初始开销）
```

---

## 五、v-if 和 v-for

不推荐同时使用 `v-if` 和 `v-for`。当二者同时存在于一个元素上时，`v-if` 会**先于** `v-for` 执行，导致 `v-if` 无法访问 `v-for` 中的变量，行为不符合直觉。

正确做法：用 `computed` 先过滤数据，再在模板中 `v-for` 渲染。

---

## 六、设计思想：条件渲染的两种策略

### 痛点：如何控制元素显示/隐藏

原生 JS 控制元素显示有两条路：

```js
// 路线 A：直接操作 DOM，删除/创建元素
element.parentNode.removeChild(element)  // 隐藏
container.appendChild(newElement)         // 显示

// 路线 B：操作 CSS，切换 display
element.style.display = 'none'  // 隐藏
element.style.display = 'block' // 显示
```

路线 A 开销大（销毁重建），路线 B 保留 DOM（始终占用内存）。这两种策略对应了 Vue 的 `v-if` 和 `v-show`。

### Vue 的设计：声明式描述 + 编译期/运行时优化

```
原生思路：   我要手动删/建 DOM，或手动改 display
Vue 思路：   我声明条件，框架自动选择策略
```

#### v-if 的内部机制（伪代码）

```js
// 伪代码：v-if 的渲染逻辑
function renderVIf(condition, createVNode) {
  if (condition) {
    // 条件为真：创建 vnode，挂载到 DOM
    // 包括子组件的 mounted、事件监听器的绑定
    return createVNode()
  } else {
    // 条件为假：不创建，若之前已挂载则销毁
    // 包括子组件的 unmounted、事件监听器的解绑
    return null  // DOM 中不存在该元素
  }
}
```

- **惰性渲染**：初始条件为假时，完全跳过渲染（零开销）
- **切换时彻底销毁/重建**：事件监听器解绑、子组件销毁、再重建时重新绑定/挂载

#### v-show 的内部机制（伪代码）

```js
// 伪代码：v-show 的渲染逻辑
function renderVShow(condition, el) {
  // 始终渲染元素到 DOM
  el.style.display = condition ? '' : 'none'
}
```

- **始终渲染**：初始无论条件如何，元素都在 DOM 中
- **切换只改 CSS**：不销毁不重建，只切 `display` 属性

### 设计收益

| 设计决策 | 解决的问题 |
|---------|-----------|
| v-if 真实销毁/重建 | 条件不满足时零内存占用，释放事件监听器和子组件 |
| v-if 惰性渲染 | 初始条件为假时跳过渲染，加快首屏 |
| v-show 仅切 display | 频繁切换时无创建/销毁开销，切换流畅 |
| `<template>` 支持 v-if | 不引入额外 DOM 节点即可批量切换 |
| `v-else` / `v-else-if` 链式语法 | 类似 JS 的 if/else，表达多分支条件更自然 |

> 💡 **一句话总结**：条件渲染的设计本质是**把"删/建 DOM"和"切 CSS display"两种底层策略封装成声明式指令**，让开发者描述"什么条件显示什么"，框架按场景自动选最优策略。

---

## 七、速查表

| 场景 | 写法 | 备注 |
|------|------|------|
| 单条件渲染 | `v-if="cond"` | 条件为假时 DOM 不存在 |
| 双分支 | `v-if` + `v-else` | v-else 必须紧跟 v-if |
| 多分支 | `v-if` + `v-else-if` + `v-else` | v-else-if 可连续多次 |
| 批量切换 | `<template v-if>` | 不引入额外 DOM 节点 |
| 频繁切换显示 | `v-show="cond"` | 仅切 display，DOM 始终存在 |
| 数据过滤后渲染 | `computed` + `v-for` | 不要同元素混用 v-if 和 v-for |

---

## 八、核心原则总结

1. **v-if 是真实条件渲染**：条件为假时元素不在 DOM 中，切换时销毁/重建（含事件监听器和子组件）
2. **v-show 是 CSS 切换**：元素始终在 DOM 中，仅切 `display` 属性
3. **频繁切换用 v-show，很少改变用 v-if**：根据切换频率选择以优化性能
4. **v-if 支持惰性渲染**：初始条件为假时完全不渲染，加快首屏
5. **v-else / v-else-if 必须紧跟**：否则不会被 Vue 识别
6. **v-show 不支持 template 和 v-else**：它只是切 display，没有分支语义
7. **不要同元素混用 v-if 和 v-for**：v-if 先于 v-for 执行，优先级导致行为不直觉，用 computed 替代
