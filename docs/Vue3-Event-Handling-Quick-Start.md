# Vue 3 事件处理 · 快速入门

> 本文精简自 [Vue 3 官方文档 - 事件处理](https://cn.vuejs.org/guide/essentials/event-handling.html)，兼顾底层原理与实战写法，适合快速上手。

---

## 一、概述

事件处理 = **监听用户交互（点击、输入、提交等），触发对应逻辑**。Vue 用 `v-on` 指令（简写 `@`）绑定事件。

| 写法 | 形式 | 示例 |
|------|------|------|
| 完整写法 | `v-on:event="handler"` | `v-on:click="handle"` |
| 简写 | `@event="handler"` | `@click="handle"` |

事件处理器有两种形式：
- **内联事件处理器**：直接写 JS 语句
- **方法事件处理器**：绑定组件方法名

---

## 二、内联事件处理器

直接在模板里写简单 JS 语句，适合极简场景：

```js
const count = ref(0)
```

```html
<button @click="count++">Add 1</button>
<p>Count is: {{ count }}</p>
```

**使用场景**：计数器、开关切换等单行逻辑。

```html
<button @click="isVisible = !isVisible">切换显示</button>
<p v-if="isVisible">我出来了</p>
```

---

## 三、方法事件处理器

逻辑复杂时，绑定组件上定义的方法名：

```js
const name = ref('Vue.js')

function greet(event) {
  alert(`Hello ${name.value}!`)
  // event 是原生 DOM 事件对象
  if (event) {
    alert(event.target.tagName)  // 触发事件的元素标签名
  }
}
```

```html
<!-- greet 是方法名，自动接收原生 event 参数 -->
<button @click="greet">Greet</button>
```

**使用场景**：需要多步逻辑、访问响应式数据、调用其他方法的场景。

```js
function handleLogin(event) {
  if (!form.value.username || !form.value.password) {
    showError('请填写完整信息')
    return
  }
  submitForm(form.value)
}
```

```html
<button @click="handleLogin">登录</button>
```

### Vue 如何判断内联还是方法？

模板编译器检查 `@click` 的值：
- **合法标识符或属性路径**（如 `greet`、`foo.bar`）→ 方法事件处理器
- **JS 表达式**（如 `count++`、`say('hi')`）→ 内联事件处理器

---

## 四、在内联处理器中调用方法

直接绑方法名无法传参。内联调用可传入自定义参数：

```js
function say(message) {
  alert(message)
}
```

```html
<button @click="say('hello')">Say hello</button>
<button @click="say('bye')">Say bye</button>
```

**使用场景**：多个按钮调用同一方法但传不同参数。

```html
<button @click="filterProducts('all')">全部</button>
<button @click="filterProducts('active')">上架中</button>
<button @click="filterProducts('archived')">已下架</button>
```

### 访问原生事件对象

内联调用方法时，原生 event 不会自动传入。需手动传入：

```html
<!-- 方式 1：用 $event 变量 -->
<button @click="warn('表单尚未提交', $event)">Submit</button>

<!-- 方式 2：用内联箭头函数 -->
<button @click="(event) => warn('表单尚未提交', event)">Submit</button>
```

```js
function warn(message, event) {
  if (event) event.preventDefault()
  alert(message)
}
```

**使用场景**：既要传自定义参数，又需要阻止默认行为或访问事件目标。

```html
<a @click="handleLink('详情页', $event)">查看详情</a>
```
```js
function handleLink(page, event) {
  event.preventDefault()  // 阻止 <a> 跳转
  router.push(`/${page}`)
}
```

---

## 五、事件修饰符

### 为什么需要修饰符

常见需求：阻止默认行为（`preventDefault`）、阻止冒泡（`stopPropagation`）。直接在方法里写可以，但让方法混入了 DOM 细节：

```js
// ❌ 方法里处理 DOM 细节，不够纯粹
function submitForm(event) {
  event.preventDefault()   // 阻止表单提交刷新页面
  // ...业务逻辑
}
```

修饰符把这些 DOM 细节抽到模板层，让方法专注于业务逻辑：

```html
<!-- ✅ 修饰符处理 DOM 细节，方法只管业务 -->
<form @submit.prevent="submitForm">
```

### 修饰符列表

| 修饰符 | 作用 | 等价 JS |
|--------|------|---------|
| `.stop` | 阻止事件冒泡 | `event.stopPropagation()` |
| `.prevent` | 阻止默认行为 | `event.preventDefault()` |
| `.self` | 仅 event.target 是元素本身时触发 | `if (event.target !== el) return` |
| `.capture` | 使用捕获模式监听 | `addEventListener('click', fn, true)` |
| `.once` | 事件只触发一次 | 手动移除监听器 |
| `.passive` | 不阻止默认行为（优化滚动性能） | `{ passive: true }` |

### 用法示例

```html
<!-- 阻止冒泡 -->
<a @click.stop="doThis"></a>

<!-- 阻止默认行为（表单提交不刷新页面） -->
<form @submit.prevent="onSubmit"></form>

<!-- 链式修饰符 -->
<a @click.stop.prevent="doThat"></a>

<!-- 只有修饰符，无方法 -->
<form @submit.prevent></form>

<!-- 仅自身点击触发（非子元素冒泡） -->
<div @click.self="doThat">...</div>
```

**使用场景**：
- `.prevent`：表单提交阻止刷新、`<a>` 阻止跳转
- `.stop`：嵌套元素点击，内层不触发外层
- `.self`：弹窗背景点击关闭，内容区点击不关闭

```html
<!-- 弹窗：点击背景关闭，点击内容不关闭 -->
<div class="overlay" @click.self="closeModal">
  <div class="modal">
    <p>点击我不会关闭弹窗</p>
  </div>
</div>
```

### ⚠️ 修饰符顺序

修饰符按书写顺序生成代码，顺序影响行为：

```html
<!-- 阻止元素及子元素所有点击的默认行为 -->
@click.prevent.self

<!-- 仅阻止元素本身点击的默认行为 -->
@click.self.prevent
```

### `.capture` / `.once` / `.passive`

```html
<!-- 捕获模式：事件从外向内触发时先处理 -->
<div @click.capture="doThis">...</div>

<!-- 只触发一次 -->
<a @click.once="showTooltip"></a>

<!-- 滚动立即执行，不等待 onScroll（提升移动端性能） -->
<div @scroll.passive="onScroll">...</div>
```

> ⚠️ 不要同时使用 `.passive` 和 `.prevent`——`.passive` 告诉浏览器"不会阻止默认行为"，`.prevent` 会被忽略并触发浏览器警告。

---

## 六、按键修饰符

监听键盘事件时，常需要判断具体按键。Vue 用修饰符代替手动 `event.key` 判断：

```html
<!-- 仅 Enter 键触发 -->
<input @keyup.enter="submit" />

<!-- 仅 PageDown 键触发（kebab-case） -->
<input @keyup.page-down="onPageDown" />
```

### 按键别名

Vue 为常用按键提供别名：

| 别名 | 按键 |
|------|------|
| `.enter` | 回车 |
| `.tab` | Tab |
| `.delete` | Delete 和 Backspace |
| `.esc` | Esc |
| `.space` | 空格 |
| `.up` / `.down` / `.left` / `.right` | 方向键 |

**使用场景**：搜索框回车搜索、Esc 关闭弹窗、方向键导航。

```html
<input @keyup.enter="search" placeholder="回车搜索" />
<input @keyup.esc="closeModal" placeholder="Esc 关闭" />
```

### 系统按键修饰符

`.ctrl` / `.alt` / `.shift` / `.meta`（Mac 是 Command，Windows 是 Win 键）——仅在对应修饰键按下时触发：

```html
<!-- Alt + Enter -->
<input @keyup.alt.enter="clear" />

<!-- Ctrl + 点击 -->
<div @click.ctrl="doSomething">Do something</div>
```

> ⚠️ 系统按键修饰符与 `keyup` 一起用时，事件触发时该键必须仍处于按下状态。单独松开 Ctrl 不会触发 `keyup.ctrl`。

### `.exact` 修饰符

精确控制所需按键组合：

```html
<!-- Ctrl 按下即触发，即使同时按了 Alt/Shift -->
<button @click.ctrl="onClick">A</button>

<!-- 仅 Ctrl 且无其他系统键 -->
<button @click.ctrl.exact="onCtrlClick">A</button>

<!-- 无任何系统按键时触发 -->
<button @click.exact="onClick">A</button>
```

**使用场景**：快捷键组合，如 `Ctrl+S` 保存、`Ctrl+Enter` 发送。

```html
<textarea @keydown.ctrl.enter="send" placeholder="Ctrl+Enter 发送"></textarea>
```

---

## 七、鼠标按键修饰符

| 修饰符 | 触发条件 |
|--------|---------|
| `.left` | 主键（通常左键） |
| `.right` | 次键（通常右键） |
| `.middle` | 辅助键（中键/滚轮） |

```html
<!-- 右键弹出菜单 -->
<div @contextmenu.right="showMenu">右键我</div>
```

> 💡 这里 `.left/.right/.middle` 指的是设备逻辑按键，不是物理左右。左手鼠标、触控板等设备的映射可能不同。

---

## 八、设计思想：修饰符即声明式事件控制

### 痛点：方法里混入 DOM 细节

原生事件处理需要在方法内手动调用 `preventDefault`、`stopPropagation`：

```js
// 原生写法：方法承担了太多职责
function handleClick(event) {
  event.stopPropagation()      // DOM 细节
  event.preventDefault()      // DOM 细节
  if (event.target !== this) return  // DOM 细节
  // ↓ 业务逻辑（被淹没）
  doSomething()
}
```

问题：
- 方法同时处理"事件控制"和"业务逻辑"，职责混乱
- 相同的事件控制代码在多个方法中重复
- 阅读模板时看不出事件被如何控制

### Vue 的设计：修饰符抽到模板层

```
原生思路：   方法里写 preventDefault / stopPropagation
Vue 思路：   模板上写修饰符，方法只管业务
```

```html
<!-- 事件控制在模板层，一目了然 -->
<div @click.stop.prevent="doSomething">
```

```js
// 方法只管业务逻辑，纯粹
function doSomething() {
  // 纯业务逻辑，无 DOM 细节
}
```

### 内部机制（伪代码）

```js
// 伪代码：编译器把修饰符转成包装函数
function withModifiers(handler, modifiers) {
  return function (event) {
    if (modifiers.stop) event.stopPropagation()
    if (modifiers.prevent) event.preventDefault()
    if (modifiers.self && event.target !== event.currentTarget) return
    if (modifiers.once && alreadyCalled) return
    // 所有修饰符检查通过后，才调用真正的方法
    handler(event)
  }
}

// 编译结果
// @click.stop.prevent="doThis" 编译为：
el.addEventListener('click', withModifiers(doThis, ['stop', 'prevent']))
```

### 按键修饰符同理

```js
// 伪代码：按键修饰符编译为条件判断
function withKeyModifier(handler, key) {
  return function (event) {
    if (event.key !== key) return  // 不匹配则不触发
    handler(event)
  }
}

// @keyup.enter="submit" 编译为：
el.addEventListener('keyup', withKeyModifier(submit, 'Enter'))
```

### 设计收益

| 设计决策 | 解决的问题 |
|---------|-----------|
| 修饰符在模板层声明 | 事件控制方式一目了然，不深入方法代码 |
| 方法只管业务逻辑 | 方法可复用、可测试，不混入 DOM 细节 |
| 修饰符可链式组合 | `.stop.prevent` 组合表达，比嵌套函数清晰 |
| 按键修饰符替代 `event.key` 判断 | 模板直接表达"什么键触发"，无需方法内 if |
| `.exact` 精确控制 | 组合键场景精确匹配，避免误触发 |
| `.passive` 性能优化 | 滚动场景告诉浏览器不阻止默认行为，提升流畅度 |

> 💡 **一句话总结**：事件修饰符的设计本质是**把"事件控制"从方法中抽离到模板**——模板声明"事件怎么处理"（阻止冒泡、阻止默认、限定按键），方法只负责"做什么"（业务逻辑），职责分离。

---

## 九、速查表

| 场景 | 写法 | 备注 |
|------|------|------|
| 内联语句 | `@click="count++"` | 单行逻辑 |
| 绑定方法 | `@click="handle"` | 自动传入 event |
| 传参调用 | `@click="say('hi')"` | 需手动传 $event |
| 传参 + event | `@click="say('hi', $event)"` | 或用箭头函数 |
| 阻止冒泡 | `@click.stop="handle"` | 不冒泡到父元素 |
| 阻止默认 | `@submit.prevent="handle"` | 表单不刷新 |
| 仅自身触发 | `@click.self="handle"` | 排除子元素冒泡 |
| 链式 | `@click.stop.prevent="handle"` | 顺序影响行为 |
| 仅一次 | `@click.once="handle"` | 触发后自动移除 |
| 回车触发 | `@keyup.enter="handle"` | 常用按键别名 |
| 组合键 | `@keyup.ctrl.enter="handle"` | 系统修饰键 |
| 精确组合 | `@click.ctrl.exact="handle"` | 不含其他系统键 |
| 右键 | `@contextmenu.right="handle"` | 右键菜单 |

---

## 十、核心原则总结

1. **`@` 是 `v-on` 的简写**：`@click` 等价于 `v-on:click`
2. **简单逻辑用内联，复杂逻辑用方法**：`count++` 内联，多步逻辑绑定方法
3. **内联调用方法需手动传 `$event`**：绑方法名自动传入，内联调用不会
4. **修饰符处理 DOM 细节，方法专注业务逻辑**：`@click.stop.prevent="fn"` 让 fn 更纯粹
5. **修饰符顺序影响行为**：`.stop.prevent` 和 `.prevent.stop` 效果可能不同
6. **不要同时使用 `.passive` 和 `.prevent`**：语义矛盾，`.prevent` 会被忽略
7. **系统按键修饰符与 `keyup` 搭配需注意**：触发时该键必须仍处于按下状态
8. **`.exact` 精确控制组合键**：避免 `Ctrl+其他` 误触发 `Ctrl` 快捷键
9. **鼠标修饰符是设备逻辑键**：`.right` 指次键，不一定物理在右
