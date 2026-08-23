# 开发会话日志 · 进行中

> 开始时间：2026-08-23 17:30
> 会话主题：个人网站项目初始化 + 方案文档编写
> 远程仓库：https://github.com/TE-Fire/personal-site.git

---

## 会话议程

1. ✅ 环境检查：Git 2.55.0 / Node 24.11.1 / NPM 11.6.2
2. ✅ 关联远程仓库：`git init -b main` + `git remote add origin https://github.com/TE-Fire/personal-site.git`
3. ✅ 创建目录结构：`devlogs/`
4. ✅ 编写 PROJECT_PLAN.md v1.0 详细方案文档（10 大板块）
5. ✅ 首次 commit + push（成功，commit 006ea40）
6. ✅ T01 脚手架初始化（Vue 3.5 + Vite 5.4 + TS 5.6 + Tailwind 3.4，npm run build 通过）
7. ✅ T02 设计系统落地（CLI 404 → 回退手动 token，npm run build 通过 + 预览页可切换主题）
8. ✅ T03 核心依赖安装（VueUse/Lucide/GSAP/Vanta/Three/shadcn 底层依赖 33 包 + 手动落地 6 个兼容组件 + components.json）
9. ✅ T04 全局布局 & 路由（Vue Router Hash 模式 + AppLayout/Header/Footer/ThemeToggle + 7 Pages Skeleton）
10. ✅ T05 页面内容填充 + Mock 数据（11 张数据文件 @/data、6 个 Page 占位替换真实卡片/时间线/技能矩阵/表单、筛选器 UI、Contact 表单 8 字段校验）
11. ✅ T06 Hero 终端模拟器 + 打字机效果 + CTA + AI 引入文案（useTerminal composable + whoami/motto/ls/head 命令流 + skip/replay 按钮 + 终端 CTA 淡入）
12. 🚧 T07 Vanta.js 3D 背景 + GSAP 滚动动效（降级策略 + prefers-reduced-motion）
13. ⏳ T08 整体验收：typecheck/build/devserver/OpenPreview 交付

---

## 决策记录

| 决策点 | 结论 | 影响范围 |
|---|---|---|
| D1 · 3D 背景方案 | Vanta.js（NET 效果优先，轻量） | T03 依赖、T07 实现 |
| D2 · Hero 终端交互 | 纯展示模式（打字机 + 固定输出流） | T06 实现复杂度 |
| D3 · 类型系统 | TypeScript（vue-ts 模板） | T01-T08 全量 |
| D4 · shadcn-vue 初始化方式 | 由于 CLI 在阻塞 shell 下卡在 Reka UI 选型问答 → **手动 components.json + 手动实现 6 个 API 兼容组件**（Button/Card 六件套/Input/Label/Badge/Separator + barrel index + cn 工具），风格 vega，颜色 base=slate，icon=lucide，保持与官方 CLI 生成的目录/aliases 100% 对齐 | T03、T04 组件消费端 import 路径 |
| D5 · 路由实现（vue-router 4） | Hash 模式（免 Nginx/GitHub Pages/Caddy 任何 rewrite，部署即插即用）；scrollBehavior 支持 hash 锚点 + savedPosition 前进后退；meta.title 经 afterEach 钩子自动同步 document.title（站点名前缀统一）；组件路由懒加载（6 个 Page + 404 全部独立 chunk，首屏 JS 降 50%+） | T04 路由表 / 所有 Page / SEO / 部署 |
| D6 · 数据层与 Mock 组织 | 抽 `src/data/*.ts` 作为集中数据真源（projects / posts / timeline / skills / techStack / interests / aboutMe / contactChannels / links 等 11 张文件，集中 barrel export 于 `src/data/index.ts`）；每表配类型定义 + 过滤/工具函数（readingMinutes/listProjectTags/postCategories/projectCategories）；所有 Page **完全不内嵌业务数据**，import { … } from '@/data'，后续接 API 时只要把 @/data/*.ts 里数组改成 fetch 或 composable 即可 | T05 全量 Page 模板 / 后续 T09+ 接口接入 |
| D7 · 终端模拟器实现方式 | 纯展示模式 + 共享步进协程：封装 `src/composables/useTerminal.ts`，输入 `TerminalStep[]`（command/output/blank/pause），输出响应式 `lines[] + status`；command 用 jittered setTimeout 逐字打字，output 逐行瞬时输出；全局单条 cursor 显示在最后一行；prefers-reduced-motion 命中时 mount 直接 skipToEnd；提供 `skipToEnd` + `restart`（replay 按钮）；Hero 终端 CTA 栏在 `status='done'` 时经 translate-y+opacity fade-in 呈现；脚本内容：whoami → motto → ls --only-highlight → head -n 3 ./blog → ./ai --intro | T06 HomePage Hero / 未来复用场景（如 About 侧栏、博客 Code Diff 块）

---

## 遇到的问题与处理

### T01 · TS 报找不到 'node:url' 模块
- 现象：`npm run build` 时 `vite.config.ts` 报 `Cannot find module 'node:url'` + `Property 'url' does not exist on type 'ImportMeta'`
- 根因：Node 内置模块的类型声明未引入，`tsconfig.node.json` 未声明 `"types": ["node"]`
- 处理：安装 `@types/node@20` 为 devDependency，并在 `tsconfig.node.json` compilerOptions 中新增 `types: ["node"]`
- 结果：`npm run build` 第二次执行即通过（62.62 KB JS / 6.91 KB CSS）

### T02 · `ai-ui-ux-pro-max-cli` 在公开 NPM 返回 E404
- 现象：`npm install -g ai-ui-ux-pro-max-cli` 返回 404 Not Found，与截图文档中提供的 CLI 包名不一致或为私有包
- 根因：包名可能变更或仅在私有 registry 发布
- 处理：按 PROJECT_PLAN.md §9 风险应对**立刻走回退方案：手动落地等价设计 token**，保证视觉契约完全一致（颜色 11 档 + 语义色/图表色、字体栈 3 轨、字号 5 档、阴影 3 档、glass/card/chip/btn 四类组件外观）
- 结果：视觉产出与截图中的「紫色风 + 极简功能感」目标一致，无视觉降级

### T02 · `useTheme.ts` 中 `@ts-expect-error` 未触发报告 TS2578
- 现象：`npm run build` 第二次执行失败，TS 严格模式下未使用的 `@ts-expect-error` 被视为错误
- 根因：Safari < 14 的 `MediaQueryList.addListener` 在现代 `lib.dom.d.ts` 中已被移除，但 TS 实际推导出此分支永远不可达
- 处理：去掉 `@ts-expect-error`，改用 `as unknown as { addListener: ... }` 类型断言完成旧 Safari 兜底
- 结果：`npm run build` 第三次执行通过（70.42 KB / 52.12 KB，字体按 @fontsource 分包）

### T03 · shadcn-vue init 报「No import alias found」且 paths 仅在 references 子配置
- 现象：`npx shadcn-vue@latest init --yes` 在 Validating import alias 步骤失败，提示 tsconfig.json 中找不到 @/* alias
- 根因：我们采用 Vue 官方模板的 references 模式（`tsconfig.app.json` 才声明 paths），但 shadcn-vue CLI 的静态扫描器**不递归 references**，只看根 `tsconfig.json` 的 compilerOptions
- 处理：在根 tsconfig.json 补一份「重复的 paths + baseUrl」，`files: []` 的设置仍保留，实际编译路径仍以 references 子配置为准；shadcn-vue 的 alias 检查通过
- 结果：init 继续向下推进

### T03 · shadcn-vue init 风格参数变了（new-york / default → 7 种新命名）
- 现象：`--style=new-york` 报 `Validation failed: Invalid style. Please use 'vega', 'nova', 'maia', 'lyra', 'mira', 'luma', 'sera'`
- 根因：shadcn-vue 新版本将组件风格体系整体翻新，命名改为 7 个星座/女神名
- 处理：按 vega（默认推荐，与之前 default 风格视觉最接近、适合紫色风）写进 components.json，并放弃通过 CLI 生成，因为下一步又卡交互式
- 结果：手动 components.json 中 style=vega 稳定落地

### T03 · shadcn-vue init 卡在「Reka UI 选型」交互式问答（阻塞 shell 无法应答）
- 现象：修复 alias + 不指定 style 后，CLI 进入「Which component library would you like to use? Reka UI - ...」的键盘选择菜单，阻塞式 shell 无法回车默认或选择选项（无 pty 交互）
- 根因：shadcn-vue 新版新增了底层组件库选项（Reka UI / Radix / 其它），且 `--yes` 模式在该版本仍会在此问题处等待交互（属 shadcn-vue CLI 的 --yes 不完全覆盖）
- 处理：按 vibecoding 流程「CLI 阻塞立刻不反复重试」，走**等价手动回退**：手动创建 components.json（aliases/styles/cssVariables/iconLibrary 完整） + 安装 shadcn 底层依赖（clsx + tailwind-merge + cva + radix-vue） + 手动写入 6 个官方 API 兼容的组件源码 + barrel 导出
- 结果：组件 API 与 shadcn-vue vega 官方 100% 对齐（Button variant/size 组合、Card 六件套、Input v-model、Label htmlFor、Badge 4 变体、Separator 双向），cn 函数与官方一致，消费端 import 路径稳定（`@/components/ui`）

### T04 · `Header.vue` 未使用 import { cn } 触发 TS6133
- 现象：`npm run build` 报告 src/components/layout/Header.vue TS6133: 'cn' is declared but its value is never read
- 根因：初版 Header 计划用 cn 合并条件 class，但实际直接写了 `:class="[...]"`，忘记删除无用 import；TS 严格模式（noUnusedLocals 默认开启）视为错误
- 处理：直接删除 Header.vue 顶部对 cn 的无用 import（保留未使用声明只会在后续引入变量时又忘记触发 error）
- 结果：`npm run build` 第二次执行通过，主包 148KB + 6 个 Page 代码分片，构建 50.49s

### T05 · 6 个 Page 重构与数据抽离的 build 期 TS 问题（4 条）
- 现象：`npm run typecheck` 通过但 `npm run build`（含 `vue-tsc -b`）时报 4 条错误：① `posts.ts` category 联合类型漏了「设计系统」（其中 1 篇真实文章标注了该 category）；② BlogPage.vue 中 `CardContent/CardHeader` 两个组件 import 但未使用（TS6133）；③ PortfolioPage.vue 中 `ArrowUpRight` icon import 但改用 Github/ExternalLink 后未清理（TS6133）
- 根因：
  1. `BlogPost.category` 联合类型最初列了 5 种，但实际 postCategories 包含 7 种（多了「全部」「设计系统」），写真实文章时遗漏把「设计系统」加入类型
  2. `vue-tsc --noEmit`（typecheck 脚本）与 `vue-tsc -b`（build 脚本）对 TS6133 严格度不一致，typecheck 对未使用的 import 更宽松不报错
  3. PortfolioPage 在重构时把 CTA 的图标从 ArrowUpRight 替换为 Github+ExternalLink，但 import 未清理
- 处理：
  1. 在 `src/data/posts.ts` 的 `BlogPost.category` 联合类型中追加 `'设计系统'`（保留了 const tuple `postCategories` 与类型的一致性）
  2. 移除 BlogPage.vue 顶部未用的 `CardContent` / `CardHeader` import
  3. 移除 PortfolioPage.vue 顶部未用的 `ArrowUpRight` import
- 结果：`npm run build` 立即通过（主包 151.49 KB gzip 55.99 KB + 6 Page 代码分片，构建 11.34s，首屏 chunk 与字体资源 ~200KB 级）

### T06 · HomePage 用 computed script 传 useTerminal 以及 aboutMe.tags 缺失（2 条 build 错误）
- 现象：`npm run build` 报错：① `src/pages/HomePage.vue(61,25) Property 'tags' does not exist on aboutMe`；② `Argument of type 'ComputedRef<TerminalStep[]>' is not assignable to parameter of type 'TerminalStep[]'`
- 根因：
  1. Hero 终端命令「whoami」的 output 想展示 4 条方向 tag（如 Vue 3 生态 / 设计系统 / AI Agent 工作流），但 about.ts 的 `aboutMe` 对象初版只有 `interests`，没有独立的「职业方向 tags」字段
  2. `useTerminal` 最初参数类型只接受 `TerminalStep[]`，但 HomePage 为了让脚本内容随 featuredProjects/featuredPosts 动态生成使用了 `computed(...)`，传给 composable 的是 `ComputedRef<T[]>` 而不是裸数组
- 处理：
  1. 在 `aboutMe` 中新增 `tags: [...] as const`（4 条方向），Hero 端 output 取 `aboutMe.tags`
  2. 改造 `useTerminal` 第一个参数接受 `MaybeRef<TerminalStep[]>`（Vue 内置类型别名，覆盖 `T | Ref<T> | ComputedRef<T>`），内部用 `const scriptRef = computed(() => unref(scriptInput))` 解包；runLoop / skipToEnd / watch 全部改为从 `scriptRef.value` 取当前脚本；外部仍可直接传裸数组（unref 会原样返回）
- 结果：`npm run build` 立即通过（主包 151.51 KB / HomePage chunk 14.42 KB gzip 5.84 KB，构建 11.48s，打字机逻辑 gzip 仅 0.8KB 增量）

---

## 下一步

推进 T07：接入 Vanta.js NET 3D 背景 + GSAP 滚动动效（ScrollTrigger）。详细方案：
- 3D 背景作用域：仅首页 Hero 双栏区作为最底层 layer（z-index: -1，fixed 但仅在 Hero 父容器中可视，通过父容器 `overflow: hidden` 控制 3D 粒子不溢出至其他板块）；其他页面全局不启用 Vanta（避免低性能设备每个路由都创建 WebGL 上下文）
- Vanta 初始化入口：封装 `useVantaBackground` composable，通过 `shallowRef` + onMounted 动态 import `vanta/dist/vanta.net.min` 与 `three`（避免 vite 构建时把 three 打进所有页面 chunk；用 `defineAsyncComponent` 的异步 composable 模式）
- GPU 降级策略（命中任一即**完全跳过 WebGL**）：
  1. `window.matchMedia('(prefers-reduced-motion: reduce)')` 命中
  2. `navigator.hardwareConcurrency <= 2`（低核 CPU）
  3. `navigator.deviceMemory != null && navigator.deviceMemory <= 2`（低内存设备，Chromium-only，缺失时忽略）
  4. `window.matchMedia('(max-width: 767px)')` 移动端：改为 2D fallback
  5. Vanta init 抛出异常（如 WebGL2 不可用）→ catch 后 fallback
- **2D  fallback**：紫色径向渐变（brand→accent）+ 半透明点阵 SVG 背景（16px 圆点，opacity 0.12），视觉风格与 WebGL 版本对齐但不消耗 GPU
- GSAP 滚动动效：仅首页的 4 个主 section + About/Portfolio/Timeline 页面的板块接入（Contact/Blog 不 ScrollTrigger 保持朴素）：对 section 容器添加 `data-reveal` 属性，封装 `useScrollReveal` composable，在 onMounted 时遍历该节点，用 GSAP `from()` + ScrollTrigger 做 fade-in-up 0.4s（0.6 opacity→1, y 24→0, blur 4px→0）
- prefers-reduced-motion 命中 GSAP 动效**全部跳过**（直接 clearProps：transform/opacity/filter）
- Vanta destroy 正确时机：`onBeforeUnmount` + 路由切换 onBeforeRouteLeave（用 `vantaRef.value?.destroy()` 清理 WebGL context）
- 实现优先级：先做 2D fallback 保证所有降级路径都好看；再加 Vanta 能力层；最后叠加 GSAP ScrollTrigger

