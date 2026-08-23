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
8. 🚧 T03 核心依赖安装（shadcn-vue + VueUse + Lucide + GSAP + Vanta.js）
9. ⏳ T04 全局布局 & 路由
10. ⏳ …（后续 Todo 推进时追加）

---

## 决策记录

| 决策点 | 结论 | 影响范围 |
|---|---|---|
| D1 · 3D 背景方案 | Vanta.js（NET 效果优先，轻量） | T03 依赖、T07 实现 |
| D2 · Hero 终端交互 | 纯展示模式（打字机 + 固定输出流） | T06 实现复杂度 |
| D3 · 类型系统 | TypeScript（vue-ts 模板） | T01-T08 全量 |

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

---

## 下一步

推进 T03（shadcn-vue 初始化 + VueUse + Lucide + GSAP + Vanta.js 安装）→ T04 全局布局 → ...
