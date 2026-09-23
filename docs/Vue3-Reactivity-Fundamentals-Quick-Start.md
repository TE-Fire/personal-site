# Vue 3 响应式基础 · 快速入门

> 本文精简自 [Vue 3 官方文档 - 响应式基础](https://cn.vuejs.org/guide/essentials/reactivity-fundamentals.html)，兼顾底层原理与实战写法，适合快速上手。

---

## 一、概述

Vue 3 的响应式基于 **JavaScript Proxy** 实现，核心是**依赖追踪 + 触发更新**：

```
组件首次渲染 → 追踪(track)使用到的响应式状态
状态被修改  → 触发(trigger)依赖该状态的组件重新渲染
```

声明响应式状态有两种 API 风格：

| API | 适用场景 | 核心写法 |
|-----|---------|---------|
| `ref()` | 组合式 API（推荐） | `const count = ref(0)` |
| `reactive()` | 组合式 API（对象专用） | `const state = reactive({})` |
| `data` 选项 | 选项式 API | `data() { return {} }` |

> 💡 **官方建议**：组合式 API 中以 `ref()` 作为声明响应式状态的主要 API。

---

## 二、`ref()` —— 组合式 API 主力

`ref()` 接收任意类型值，返回一个带 `.value` 属性的 ref 对象：

```js
import { ref } from 'vue'

const count = ref(0)

console.log(count)        // { value: 0 }
console.log(count.value)  // 0

count.value++             // JS 中必须用 .value
```

### 模板中自动解包

在 `<template>` 中使用 ref 时**无需**写 `.value`，Vue 会自动解包：

```vue
<template>
  <button @click="count++">{{ count }}</button>
</template>

<script setup>
import { ref } from 'vue'
const count = ref(0)
</script>
```

### `<script setup>` 简化暴露

顶层声明的变量和函数可直接在模板中使用，无需手动 `return`：

```vue
<script setup>
import { ref } from 'vue'

const count = ref(0)

function increment() {
  count.value++
}
</script>

<template>
  <button @click="increment">{{ count }}</button>
</template>
```

---

## 三、为什么需要 ref？（底层原理）

普通变量无法被拦截访问/修改，ref 通过 `.value` 的 getter/setter 实现拦截：

```js
// 伪代码，非真实实现
const myRef = {
  _value: 0,
  get value() {
    track()        // 依赖追踪
    return this._value
  },
  set value(newValue) {
    this._value = newValue
    trigger()      // 触发更新
  }
}
```

**ref 的另一好处**：可将 ref 传递给函数，同时保留对最新值和响应式连接的访问，便于逻辑复用。

---

## 四、深层响应性

默认情况下，`ref()` 和 `reactive()` 都是**深度响应**的——嵌套对象/数组的变化也能被检测到：

```js
import { ref } from 'vue'

const obj = ref({
  nested: { count: 0 },
  arr: ['foo', 'bar']
})

// 以下都会触发更新
obj.value.nested.count++
obj.value.arr.push('baz')
```

> 💡 非原始值（对象/数组/Map/Set）内部会通过 `reactive()` 转为响应式代理。
>
> 如需放弃深层响应性以优化性能，可使用 `shallowRef()` / `shallowReactive()`（仅顶层 `.value` 被追踪）。

---

## 五、DOM 更新时机与 `nextTick()`

修改响应式状态后，DOM **不是同步更新**的。Vue 会在 "next tick" 周期中缓冲所有修改，确保每个组件只更新一次。

要在 DOM 更新后执行代码，使用 `nextTick()`：

```js
import { ref, nextTick } from 'vue'

const count = ref(0)

async function increment() {
  count.value++
  await nextTick()
  // 此时 DOM 已更新
}
```

---

## 六、`reactive()` —— 对象专用

`reactive()` 直接使对象本身具有响应性（而非包裹一层）：

```js
import { reactive } from 'vue'

const state = reactive({ count: 0 })

// 访问时不需要 .value
console.log(state.count)  // 0
state.count++
```

```vue
<template>
  <button @click="state.count++">{{ state.count }}</button>
</template>
```

### 响应式代理 ≠ 原始对象

`reactive()` 返回的是原始对象的 **Proxy**，与原始对象不相等：

```js
const raw = {}
const proxy = reactive(raw)

console.log(proxy === raw)            // false
console.log(reactive(raw) === proxy)  // true（同一原始对象返回同一代理）
console.log(reactive(proxy) === proxy) // true（代理上调用返回自身）
```

> ⚠️ **最佳实践**：始终使用代理版本，修改原始对象不会触发更新。

### `reactive()` 的三大局限性

1. **仅支持对象类型**：不能持有 `string` / `number` / `boolean` 等原始类型
2. **不能替换整个对象**：替换会丢失响应式连接（追踪基于属性访问，需保持同一引用）

   ```js
   let state = reactive({ count: 0 })
   state = reactive({ count: 1 })  // ❌ 旧引用的响应性丢失
   ```

3. **解构会断开响应式**：解构原始类型属性或传递给函数时，响应式连接丢失

   ```js
   const state = reactive({ count: 0 })
   let { count } = state    // count 与 state 断开
   count++                   // 不会影响 state
   callSomeFunction(state.count)  // 函数收到普通数字，无法追踪
   ```

> 综上，**推荐优先使用 `ref()`**，它无上述限制。

---

## 七、Ref 解包的细节

### 1. 作为 reactive 对象的属性

ref 作为深层响应式对象的属性时，会自动解包（行为像普通属性）：

```js
const count = ref(0)
const state = reactive({ count })

console.log(state.count)  // 0（自动解包）
state.count = 1
console.log(count.value)  // 1
```

若用新 ref 覆盖该属性，旧 ref 会被替换：

```js
const otherCount = ref(2)
state.count = otherCount
console.log(state.count)   // 2
console.log(count.value)   // 1（旧 ref 已断开连接）
```

### 2. 数组和集合中不解包

与 reactive 对象不同，ref 作为**数组或 Map/Set** 元素访问时**不会**解包：

```js
const books = reactive([ref('Vue 3 Guide')])
console.log(books[0].value)        // 需要 .value

const map = reactive(new Map([['count', ref(0)]]))
console.log(map.get('count').value) // 需要 .value
```

### 3. 模板中仅顶级 ref 解包

```js
const count = ref(0)
const object = { id: ref(1) }
```

```html
{{ count + 1 }}        <!-- ✅ count 是顶级 ref，解包 -->
{{ object.id + 1 }}    <!-- ❌ object.id 非顶级，结果为 [object Object]1 -->
{{ object.id }}        <!-- ✅ 作为 {{ }} 最终值时会解包 -->
```

解决：将 `id` 解构为顶级属性。

---

## 八、选项式 API 写法

### `data` 选项声明状态

```js
export default {
  data() {
    return { count: 1 }
  },
  mounted() {
    console.log(this.count)  // this 指向组件实例
    this.count = 2
  }
}
```

- 所有顶层属性会被代理到组件实例 `this` 上
- 属性仅在实例创建时添加，需确保都出现在 `data` 返回对象中（未就绪可用 `null` 占位）
- 避免使用 `$` 或 `_` 前缀的属性名（Vue 内部保留）

### `methods` 选项声明方法

```js
export default {
  data() { return { count: 0 } },
  methods: {
    increment() {
      this.count++
    }
  }
}
```

> ⚠️ **不要用箭头函数定义 methods**：箭头函数没有自己的 `this`，会导致 `this` 指向错误。

---

## 九、速查表

| 场景 | 写法 | 备注 |
|------|------|------|
| 声明原始类型状态 | `const n = ref(0)` | JS 中用 `.value`，模板自动解包 |
| 声明对象状态 | `const s = reactive({})` 或 `ref({})` | 推荐 `ref` |
| 模板中使用 ref | `{{ count }}` | 自动解包（顶级） |
| 等待 DOM 更新 | `await nextTick()` | 状态修改后异步获取 DOM |
| 放弃深层响应 | `shallowRef()` / `shallowReactive()` | 仅顶层追踪 |
| reactive 解构 | ❌ 丢失响应式 | 用 `ref` 或 `toRefs()` |
| 数组/Map 中 ref | 需 `.value` | 不会自动解包 |

---

## 十、核心原则总结

1. **优先 `ref()`**：无类型限制、可整体替换、解构不丢响应式
2. **模板自动解包仅限顶级 ref**：嵌套对象中的 ref 需解构或写 `.value`
3. **修改响应式状态后用 `nextTick()` 读 DOM**：DOM 更新是异步的
4. **始终使用代理版本**：不要操作原始对象
5. **深层响应是默认行为**：性能敏感场景考虑 `shallowRef`
