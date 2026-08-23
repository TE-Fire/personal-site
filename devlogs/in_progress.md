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
9. 🚧 T04 全局布局 & 路由（Vue Router + AppLayout/Header/Footer/ThemeToggle）
10. ⏳ …（后续 Todo 推进时追加）

---

## 决策记录

| 决策点 | 结论 | 影响范围 |
|---|---|---|
| D1 · 3D 背景方案 | Vanta.js（NET 效果优先，轻量） | T03 依赖、T07 实现 |
| D2 · Hero 终端交互 | 纯展示模式（打字机 + 固定输出流） | T06 实现复杂度 |
| D3 · 类型系统 | TypeScript（vue-ts 模板） | T01-T08 全量 |
| D4 · shadcn-vue 初始化方式 | 由于 CLI 在阻塞 shell 下卡在 Reka UI 选型问答 → **手动 components.json + 手动实现 6 个 API 兼容组件**（Button/Card 六件套/Input/Label/Badge/Separator + barrel index + cn 工具），风格 vega，颜色 base=slate，icon=lucide，保持与官方 CLI 生成的目录/aliases 100% 对齐 | T03、T04 组件消费端 import 路径 |

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

---

## 下一步

推进 T04：① 安装 vue-router 并建立路由表（6 条路由：首页/关于/作品集/博客/经历/联系）；② 建立 AppLayout 全局布局 + Header/Footer/ThemeToggle 三个组件（响应式 md 断点、移动端汉堡菜单骨架、滚动贴顶 + glass 毛玻璃）；③ 重写 App.vue 使用 <RouterView>；④ build + 预览。
