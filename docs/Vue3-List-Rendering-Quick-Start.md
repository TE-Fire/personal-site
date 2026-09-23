# Vue 3 列表渲染 · 快速入门

> 本文精简自 [Vue 3 官方文档 - 列表渲染](https://cn.vuejs.org/guide/essentials/list.html)，兼顾底层原理与实战写法，适合快速上手。

---

## 一、概述

列表渲染 = **用一组数据生成一组 DOM**。Vue 提供 `v-for` 指令，基于数组/对象/数值范围来循环渲染模板。

---

## 二、v-for 基础用法

### 1. 遍历数组

`v-for` 使用 `item in items` 语法，`items` 是源数据，`item` 是当前迭代项的别名：

```js
const items = ref([
  { id: 1, message: 'Foo' },
  { id: 2, message: 'Bar' }
])
```

```html
<li v-for="item in items" :key="item.id">
  {{ item.message }}
</li>
```

支持第二个参数——当前项的索引：

```html
<li v-for="(item, index) in items" :key="item.id">
  {{ parentMessage }} - {{ index }} - {{ item.message }}
</li>
```

`v-for` 的作用域和 JS 的 `forEach` 回调类似——内部变量 `item`、`index` 只在循环内可用，外部变量可正常访问：

```js
// 等价的 JS 逻辑
items.forEach((item, index) => {
  console.log(parentMessage, item.message, index)
})
```

#### 解构写法

类似解构函数参数，可直接解构 `item` 的属性：

```html
<li v-for="{ id, message } in items" :key="id">
  {{ id }}: {{ message }}
</li>

<!-- 带索引的解构 -->
<li v-for="({ id, message }, index) in items" :key="id">
  {{ index }}. {{ message }}
</li>
```

**使用场景**：渲染商品列表、文章列表、用户列表等。

```html
<ul>
  <li v-for="{ id, name, price } in products" :key="id">
    {{ name }} - ¥{{ price }}
  </li>
</ul>
```

### 2. 使用 `of` 替代 `in`

`of` 更接近 JS 迭代器语法，语义上更明确：

```html
<div v-for="item of items"></div>
```

**使用场景**：习惯 ES6 `for...of` 语法的开发者，或需要与 `v-for="key in object"`（遍历对象）区分时。

### 3. 嵌套 v-for

多层嵌套时，内层可访问外层变量（类似函数作用域）：

```html
<li v-for="category in categories" :key="category.id">
  <h3>{{ category.name }}</h3>
  <ul>
    <li v-for="product in category.products" :key="product.id">
      {{ category.name }} / {{ product.name }}
    </li>
  </ul>
</li>
```

**使用场景**：分类下有子分类的数据结构，如电商侧边栏分类树、多级评论嵌套等。

---

## 三、v-for 遍历对象

遍历对象的所有属性，顺序基于 `Object.values()` 的返回值：

```js
const userInfo = reactive({
  name: '张三',
  age: 25,
  email: 'zhangsan@example.com'
})
```

```html
<!-- 只取值 -->
<li v-for="value in userInfo">{{ value }}</li>

<!-- 取值 + 属性名 -->
<li v-for="(value, key) in userInfo">{{ key }}: {{ value }}</li>

<!-- 取值 + 属性名 + 索引 -->
<li v-for="(value, key, index) in userInfo">{{ index }}. {{ key }}: {{ value }}</li>
```

渲染结果：
```
0. name: 张三
1. age: 25
2. email: zhangsan@example.com
```

**使用场景**：渲染用户信息表、配置项详情、详情页键值对展示。

```html
<dl>
  <template v-for="(value, key) in userProfile" :key="key">
    <dt>{{ fieldLabels[key] }}</dt>
    <dd>{{ value }}</dd>
  </template>
</dl>
```

---

## 四、v-for 使用范围值

`v-for` 可直接接受一个整数值，基于 `1...n` 重复渲染（注意从 1 开始，不是 0）：

```html
<span v-for="n in 10" :key="n">{{ n }} </span>
<!-- 输出：1 2 3 4 5 6 7 8 9 10 -->
```

**使用场景**：分页器页码、评分星星、固定数量的占位骨架屏。

```html
<!-- 分页器 -->
<button v-for="page in totalPages" :key="page" @click="goToPage(page)">
  {{ page }}
</button>

<!-- 5 星评分 -->
<span v-for="n in 5" :key="n" :class="{ filled: n <= rating }">★</span>
```

---

## 五、`<template>` 上的 v-for

与 `v-if` 类似，`v-for` 可放在 `<template>` 上渲染多个元素的块，不引入额外 DOM 节点：

```html
<ul>
  <template v-for="todo in todos" :key="todo.id">
    <li>{{ todo.text }}</li>
    <li class="divider" role="presentation"></li>
  </template>
</ul>
```

**使用场景**：每个列表项需要渲染多个标签（如标题 + 分割线 + 描述），又不想多套一层 `<div>`。

```html
<div class="article-list">
  <template v-for="article in articles" :key="article.id">
    <h3>{{ article.title }}</h3>
    <p class="meta">{{ article.date }} · {{ article.author }}</p>
    <hr />
  </template>
</div>
```

---

## 六、v-for 与 v-if

不推荐同时使用。`v-if` 的优先级比 `v-for` 高，导致 `v-if` 无法访问 `v-for` 中的变量：

```html
<!-- ❌ 报错：todo 在 v-if 执行时还未定义 -->
<li v-for="todo in todos" v-if="!todo.isComplete">
  {{ todo.name }}
</li>
```

### 正确做法

**场景 1：过滤列表项** → 用 computed 替代：

```js
const activeUsers = computed(() => users.value.filter(u => u.isActive))
```

```html
<li v-for="user in activeUsers" :key="user.id">{{ user.name }}</li>
```

**场景 2：控制整个列表显隐** → 把 v-if 移到容器元素：

```html
<ul v-if="shouldShowUsers">
  <li v-for="user in users" :key="user.id">{{ user.name }}</li>
</ul>
```

**场景 3：先循环再判断** → 用 `<template>` 包裹：

```html
<template v-for="todo in todos" :key="todo.id">
  <li v-if="!todo.isComplete">{{ todo.name }}</li>
</template>
```

---

## 七、通过 key 管理状态

### 默认行为：就地更新

Vue 默认按"就地更新"策略——数据顺序变化时，**不移动 DOM 元素**，而是就地更新每个元素的内容：

```js
// 列表 [A, B, C] 变为 [C, B, A]
// 默认：DOM 元素不动，只是把每个位置的内容从 A→C, B→B, C→A 更新
```

### 问题场景

当列表项包含**子组件状态**或**临时 DOM 状态**（如表单输入值）时，就地更新会出问题：

```html
<!-- 没有写 key，用户在第一个输入框打了字 -->
<input v-for="item in items" />
<!-- 列表顺序打乱后，输入框里的字会"跟着位置走"而非"跟着数据走" -->
```

### 解决：提供唯一 key

```html
<div v-for="item in items" :key="item.id">
  <!-- Vue 通过 key 追踪每个节点的身份 -->
  <!-- 数据顺序变化时，DOM 元素会跟着 key 移动，而非就地更新内容 -->
</div>
```

`<template v-for>` 上写 key：

```html
<template v-for="todo in todos" :key="todo.id">
  <li>{{ todo.name }}</li>
</template>
```

### key 的规则

- 值必须是**基础类型**（字符串/数字），不要用对象
- 必须在列表内**唯一**
- 推荐始终提供，除非列表内容非常简单（纯文本、无组件、无状态）

**使用场景**：可拖拽排序的列表（如看板拖拽）、可编辑的表单项列表。

```html
<!-- 可拖拽排序的任务卡片 -->
<DraggableCard
  v-for="task in tasks"
  :key="task.id"
  :task="task"
/>
```

---

## 八、组件上使用 v-for

可直接在组件上使用 `v-for`，与普通元素无异：

```html
<MyComponent v-for="item in items" :key="item.id" />
```

但组件有独立作用域，`v-for` **不会自动**将数据注入组件。需手动传 props：

```html
<TodoItem
  v-for="(todo, index) in todos"
  :key="todo.id"
  :todo="todo"
  :index="index"
  @remove="todos.splice(index, 1)"
/>
```

> 💡 不自动注入是为了**解耦**——组件不依赖 `v-for` 的上下文，可在其他场景复用。

**使用场景**：Todo List、商品卡片网格、评论列表。

```html
<div class="product-grid">
  <ProductCard
    v-for="product in products"
    :key="product.id"
    :product="product"
    @add-to-cart="handleAddToCart"
  />
</div>
```

---

## 九、数组变化侦测

### 变更方法（直接修改原数组）

Vue 能侦听这些方法并在调用时触发更新：

| 方法 | 作用 | 示例 |
|------|------|------|
| `push()` | 末尾添加 | `items.value.push(newItem)` |
| `pop()` | 末尾移除 | `items.value.pop()` |
| `shift()` | 头部移除 | `items.value.shift()` |
| `unshift()` | 头部添加 | `items.value.unshift(newItem)` |
| `splice()` | 任意位置增删 | `items.value.splice(2, 1, newItem)` |
| `sort()` | 排序 | `items.value.sort((a,b) => a.id - b.id)` |
| `reverse()` | 反转 | `items.value.reverse()` |

**使用场景**：待办事项列表——添加、删除、勾选完成任务。

```js
// 添加新待办
function addTodo() {
  todos.value.push({ id: Date.now(), text: newTodo.value, done: false })
}
// 删除已完成的
function clearDone() {
  todos.value = todos.value.filter(t => !t.done)
}
```

### 替换数组（返回新数组）

`filter()`、`concat()`、`slice()` 等不修改原数组，而是返回新数组。需手动替换：

```js
// 用新数组替换旧数组，Vue 会智能复用 DOM
items.value = items.value.filter(item => item.message.match(/Foo/))
```

> Vue 实现了 DOM 复用优化——用包含部分重叠对象的数组替换时，不会丢弃整个列表重新渲染，而是高效地复用已有 DOM。

---

## 十、展示过滤或排序后的结果

### 用计算属性（推荐）

```js
const numbers = ref([1, 2, 3, 4, 5])

const evenNumbers = computed(() => numbers.value.filter(n => n % 2 === 0))
```

```html
<li v-for="n in evenNumbers" :key="n">{{ n }}</li>
<!-- 渲染：2 4 -->
```

**使用场景**：搜索框过滤列表、按价格/时间排序。

```js
const filteredProducts = computed(() => {
  let result = products.value
  // 关键词过滤
  if (keyword.value) {
    result = result.filter(p => p.name.includes(keyword.value))
  }
  // 价格排序
  if (sortBy.value === 'price') {
    result = [...result].sort((a, b) => a.price - b.price)
  }
  return result
})
```

### 嵌套 v-for 中用方法

计算属性在多层嵌套 `v-for` 中不可行（无法传入参数），改用方法：

```js
const sets = ref([[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]])

function even(numbers) {
  return numbers.filter(n => n % 2 === 0)
}
```

```html
<ul v-for="(numbers, i) in sets" :key="i">
  <li v-for="n in even(numbers)" :key="n">{{ n }}</li>
</ul>
```

> ⚠️ `reverse()` 和 `sort()` 会修改原数组！在计算属性中使用时必须先创建副本：
> ```js
> // ❌ 修改了原数组
> return numbers.reverse()
> // ✅ 操作副本
> return [...numbers].reverse()
> ```

---

## 十一、设计思想：key 与虚拟 DOM 的 Diff 算法

### 痛点：列表更新时如何高效复用 DOM

当列表数据变化（增删改排序）时，最暴力的做法是全部删除重建：

```js
// 暴力更新：清空容器，重新创建所有 DOM
container.innerHTML = ''
items.forEach(item => {
  container.appendChild(createElement(item))  // 全部新建
})
```

但大部分列表更新只是**局部变化**（加一项、删一项、换顺序），全部重建太浪费。

### Vue 的设计：就地复用 + key 追踪

Vue 的策略分两层：

**第一层：默认就地复用**（无 key 时）

```
数据 [A, B, C] → [A, C, B]
默认行为：DOM 不动，把位置 1 的内容 B→C，位置 2 的 C→B
```

优点：不移动 DOM，只更新属性/文本，快。
缺点：含子组件状态或表单状态时，状态会"错位"。

**第二层：key 追踪**（有 key 时）

```
数据 [A, B, C] → [A, C, B]
有 key：Vue 通过 key 匹配旧节点和新节点
→ A 留在位置 0（key 匹配，复用）
→ C 从位置 2 移动到位置 1（key 匹配，移动 DOM）
→ B 从位置 1 移动到位置 2（key 匹配，移动 DOM）
```

### 内部机制（伪代码）

```js
// 伪代码：简化版 diff 算法
function patchList(oldChildren, newChildren) {
  if (hasKey) {
    // 有 key：通过 key 建立旧节点的映射表
    const oldKeyMap = new Map(oldChildren.map(c => [c.key, c]))
    for (const newChild of newChildren) {
      const oldChild = oldKeyMap.get(newChild.key)
      if (oldChild) {
        // key 匹配：复用旧 DOM，更新属性，必要时移动位置
        patch(oldChild, newChild)
      } else {
        // 无匹配：新建节点
        mount(newChild)
      }
    }
    // 删除新列表中不存在的旧节点
    removeDeleted(oldChildren, newChildren)
  } else {
    // 无 key：就地更新，按索引位置复用
    for (let i = 0; i < newChildren.length; i++) {
      if (oldChildren[i]) {
        patch(oldChildren[i], newChildren[i])  // 就地更新内容
      } else {
        mount(newChildren[i])  // 多出的新建
      }
    }
  }
}
```

### 设计收益

| 设计决策 | 解决的问题 |
|---------|-----------|
| 默认就地复用 | 无 key 时也能高效更新，适合简单列表 |
| key 追踪机制 | 带状态的列表（组件/表单）更新时状态不丢失 |
| 变更方法侦听 | `push/splice` 等直接触发更新，开发者无需手动替换数组 |
| 替换数组智能复用 | `filter` 返回新数组时仍高效复用旧 DOM |
| 不自动注入组件数据 | 组件与 v-for 解耦，保持可复用性 |

> 💡 **一句话总结**：列表渲染的设计核心是 **key 追踪 + Diff 算法**——通过 key 给每个节点建立身份证，数据变化时 Vue 精准匹配"哪些复用、哪些新建、哪些移动、哪些删除"，最小化 DOM 操作。

---

## 十二、速查表

| 场景 | 写法 | 备注 |
|------|------|------|
| 遍历数组 | `v-for="(item, index) in items"` | index 可选 |
| 解构写法 | `v-for="{ id, name } in items"` | 类似解构函数参数 |
| 遍历对象 | `v-for="(value, key, index) in obj"` | 三参数顺序固定 |
| 范围值 | `v-for="n in 10"` | 从 1 开始 |
| 批量多标签 | `<template v-for>` | 不引入额外 DOM |
| 组件循环 | `<Comp v-for="item in items" :key="item.id" :prop="item" />` | 手动传 props |
| 过滤列表 | `computed(() => items.filter(...))` | 不混用 v-if |
| 排序 | `computed(() => [...items].sort(...))` | 先拷贝再排 |
| 增删项 | `items.value.push(...)` / `items.value.splice(...)` | 变更方法自动触发更新 |
| 替换列表 | `items.value = items.value.filter(...)` | 返回新数组需替换 |

---

## 十三、核心原则总结

1. **始终提供 key**：`:key="item.id"`，除非列表内容极其简单（纯文本无状态）
2. **key 必须唯一且为基础类型**：用字符串/数字，不要用对象或数组索引（索引在排序时会变）
3. **不混用 v-if 和 v-for**：用 computed 过滤，或把 v-if 移到容器元素
4. **变更方法自动触发更新**：`push/pop/shift/unshift/splice/sort/reverse` 无需手动替换
5. **非变更方法需手动替换**：`filter/concat/slice` 返回新数组，需 `items.value = newArr`
6. **计算属性中 sort/reverse 先拷贝**：`[...arr].sort()` 避免修改原数组
7. **组件上 v-for 需手动传 props**：框架不自动注入，保证组件可复用性
8. **`<template v-for>` 的 key 写在 template 上**：而非内部元素上
