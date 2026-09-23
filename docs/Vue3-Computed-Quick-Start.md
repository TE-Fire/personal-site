# Vue 3 计算属性 · 快速入门

> 本文精简自 [Vue 3 官方文档 - 计算属性](https://cn.vuejs.org/guide/essentials/computed.html)，兼顾底层原理与实战写法，适合快速上手。

---

## 一、为什么需要计算属性

模板表达式只适合简单操作。若模板中逻辑过多，会变得臃肿难维护。

**问题示例**（模板中写复杂逻辑）：

```html
<p>Has published books:</p>
<span>{{ author.books.length > 0 ? 'Yes' : 'No' }}</span>
```

当同一逻辑需多次使用时，重复代码不可接受。**计算属性**用于描述依赖响应式状态的复杂逻辑。

---

## 二、基础用法

### 组合式 API

`computed()` 接收一个 getter 函数，返回一个**计算属性 ref**：

```vue
<script setup>
import { reactive, computed } from 'vue'

const author = reactive({
  name: 'John Doe',
  books: ['Vue 2 - Advanced Guide', 'Vue 3 - Basic Guide']
})

// 计算属性 ref
const publishedBooksMessage = computed(() => {
  return author.books.length > 0 ? 'Yes' : 'No'
})
</script>

<template>
  <p>Has published books:</p>
  <span>{{ publishedBooksMessage }}</span>
</template>
```

- JS 中访问：`publishedBooksMessage.value`
- 模板中自动解包，无需 `.value`
- Vue 自动追踪依赖：`author.books` 变化时，依赖它的绑定自动更新

### 选项式 API

```js
export default {
  data() {
    return {
      author: { books: ['Vue 2', 'Vue 3'] }
    }
  },
  computed: {
    publishedBooksMessage() {
      return this.author.books.length > 0 ? 'Yes' : 'No'
    }
  }
}
```

---

## 三、计算属性 vs 方法（核心区别）

两者结果相同，但**机制完全不同**：

| 对比维度 | 计算属性 `computed` | 方法 `methods` |
|---------|-------------------|---------------|
| **缓存** | ✅ 基于响应式依赖缓存 | ❌ 无缓存，每次调用都执行 |
| **重新计算时机** | 仅依赖变化时才重算 | 每次重渲染/调用都执行 |
| **适用场景** | 复杂派生值、计算开销大 | 需要参数、或明确不需要缓存 |

### 缓存的意义

```js
const now = computed(() => Date.now())
```

`Date.now()` 不是响应式依赖，所以这个计算属性**永远不会更新**——一旦计算就缓存固定值。这正是缓存的行为。

而方法每次调用都会返回新的时间戳。

> 💡 **什么时候用方法？** 当计算开销很小、或需要传参时，用方法即可。大型数组遍历等昂贵计算用计算属性可避免重复执行。

---

## 四、可写计算属性

计算属性**默认只读**。尝试直接修改会收到运行时警告。

如需可写，同时提供 `get` 和 `set`：

```vue
<script setup>
import { ref, computed } from 'vue'

const firstName = ref('John')
const lastName = ref('Doe')

const fullName = computed({
  get() {
    return firstName.value + ' ' + lastName.value
  },
  set(newValue) {
    [firstName.value, lastName.value] = newValue.split(' ')
  }
})

// 调用 setter，firstName 和 lastName 会被更新
fullName.value = 'Jane Smith'
</script>
```

> 💡 可写计算属性适用于"双向派生"场景，如 `fullName` ↔ `firstName` + `lastName`。

---

## 五、设计思想：getter/setter 的拦截器模式

计算属性（以及整个 Vue 响应式系统）的核心设计是**访问器拦截（Accessor Interception）**——用 getter/setter 包裹属性，在"读"和"写"的瞬间插入额外逻辑。

### 为什么需要 getter/setter？

普通 JS 属性的读写是"直通"的，框架无法感知：

```js
const obj = { count: 0 }
obj.count = 1  // 框架无法拦截这个写入，无法触发更新
```

而通过 getter/setter，每次访问和修改都会经过框架的逻辑：

```js
// 伪代码，非真实实现
const computedRef = {
  _cache: undefined,
  _dirty: true,
  get value() {
    track()                    // ① 依赖追踪：记录谁在读取我
    if (this._dirty) {
      this._cache = getter()   // ② 惰性计算：仅在需要时重算
      this._dirty = false
    }
    return this._cache         // ③ 返回缓存值
  },
  set value(newValue) {
    setter?.(newValue)         // ① 若有 setter，执行写入逻辑（通常修改源状态）
    trigger()                  // ② 通知依赖此计算属性的组件重新渲染
  }
}
```

### getter 做了什么？

| 步骤 | 作用 | 设计目的 |
|------|------|---------|
| `track()` | 记录当前正在读取该计算属性的组件/副作用 | 建立依赖关系，实现精准更新 |
| 惰性求值 | 仅在 `_dirty` 时调用 getter 计算 | 避免不必要的计算开销 |
| 返回缓存 | 依赖未变时直接返回上次结果 | 缓存机制的核心 |

### setter 做了什么？

| 步骤 | 作用 | 设计目的 |
|------|------|---------|
| 执行 setter 函数 | 把写入重定向到底层源状态 | 保持"源状态是唯一真相来源" |
| `trigger()` | 通知依赖方重新渲染 | 写入 → 响应式更新的闭环 |

### 设计的核心收益

1. **透明性**：对外暴露为普通属性（`fullName.value` 读写），使用者无需知道内部有追踪/缓存逻辑
2. **可观测性**：框架能精确知道"谁读了我"和"谁改了我"，实现最小化更新
3. **可派生**：getter 可以基于其他状态动态计算，而非存储固定值
4. **可缓存**：getter 内部可以缓存结果，依赖不变时零成本返回
5. **可校验/重定向**：setter 可以校验输入、把写入转到其他状态

> 💡 **一句话总结**：getter/setter 让"属性访问"从一次简单的内存读写，变成了一次**可被框架观察和干预的交互**——这是 Vue 响应式系统的基石。

---

## 六、获取上一个值（Vue 3.4+）

getter 的第一个参数是计算属性**上一次返回的值**：

```js
const count = ref(2)

const alwaysSmall = computed((previous) => {
  if (count.value <= 3) {
    return count.value
  }
  return previous  // count > 3 时，返回最后一次满足条件的值
})
```

**行为说明**：
- `count = 2` → `alwaysSmall = 2`
- `count = 3` → `alwaysSmall = 3`
- `count = 5` → `alwaysSmall = 3`（返回上一个值 3）
- `count = 1` → `alwaysSmall = 1`（再次满足条件，更新）

可写计算属性中同样支持：

```js
const alwaysSmall = computed({
  get(previous) { /* ... */ },
  set(newValue) { count.value = newValue * 2 }
})
```

---

## 七、最佳实践

### 1. Getter 不应有副作用

计算属性的 getter 职责是**计算并返回值**，不要：

- ❌ 改变其他响应式状态
- ❌ 发起异步请求
- ❌ 操作 DOM

> 派生副作用应使用**侦听器（watch）**，而非计算属性。

### 2. 计算属性的写入与 setter

计算属性返回的是**派生状态的快照**——它本身不存储值，而是源状态的函数输出。因此对计算属性赋值的本质是：**通过 setter 把写入重定向到底层源状态**，源状态变化后 getter 自动重新计算，生成新快照。

分两种情况：

**情况一：未定义 setter（默认只读）**

直接赋值会触发运行时警告，因为计算属性没有存储位置，写入无意义。

```js
const fullName = computed(() => firstName.value + ' ' + lastName.value)

// ❌ 运行时警告：computed 没有 setter
fullName.value = 'New Name'
```

**情况二：定义了 setter**

赋值会调用 setter，setter 内部去修改源状态，从而触发 getter 重新计算：

```js
const fullName = computed({
  get() { return firstName.value + ' ' + lastName.value },
  set(newValue) {
    // setter 的本质：把写入落到源状态上
    [firstName.value, lastName.value] = newValue.split(' ')
  }
})

// ✅ 合法：赋值 → 调用 setter → 修改源状态 → getter 重算
fullName.value = 'Jane Smith'
// 等价于直接修改源状态：
// firstName.value = 'Jane'; lastName.value = 'Smith'
```

> 💡 **核心理解**：setter 不是存储计算属性的值，而是**修改源状态的入口**。无论是否提供 setter，计算属性的值始终由 getter 从源状态派生而来。

---

## 八、速查表

| 场景 | 写法 | 备注 |
|------|------|------|
| 声明只读计算属性 | `const x = computed(() => ...)` | getter 返回派生值 |
| 声明可写计算属性 | `computed({ get() {}, set(v) {} })` | 需双向派生时使用 |
| 获取上一个值 | `computed((prev) => ...)` | Vue 3.4+ |
| 模板中使用 | `{{ publishedBooksMessage }}` | 自动解包 |
| JS 中访问 | `publishedBooksMessage.value` | ref 形式 |
| 需要传参的计算 | 用 `methods` 或返回函数 | computed 不直接支持参数 |

---

## 九、核心原则总结

1. **设计基石是访问器拦截**：getter/setter 让属性读写可被框架观察，实现追踪、缓存、触发更新
2. **计算属性用于派生状态**：从已有响应式数据计算出新值，而非存储新状态
3. **缓存是核心优势**：依赖不变时不重复计算，适合昂贵计算
4. **getter 保持纯净**：只做计算，不产生副作用
5. **setter 是修改源状态的入口**：不存储计算值，而是把写入重定向到底层源状态
6. **上一个值参数（3.4+）**：可实现"条件保留上次结果"等高级模式
