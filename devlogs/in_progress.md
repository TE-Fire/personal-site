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
7. 🚧 T02 设计系统落地（ui-ux-pro-max skill / 等效手动 token）
8. ⏳ T03 核心依赖安装
9. ⏳ …（后续 Todo 推进时追加）

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

---

## 下一步

等待 T00/T00-5 提交后，按 TodoList 依次推进 T01 → T02 → T03 → ...
