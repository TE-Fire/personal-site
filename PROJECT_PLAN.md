# 个人网站项目 · 详细开发方案

> 文档版本：v1.0 · 编写日期：2026-08-23 · 适用阶段：T00 → T08 骨架交付
> 远程仓库：https://github.com/TE-Fire/personal-site.git
> 本地目录：`d:\personal-site`

---

## 1. 技术选型（已确认）

本项目为**纯前端 SPA + Mock 数据**优先，后端 Python FastAPI 预留后续接入。所有选型均遵循「稳定版本 > 实验性 beta」原则。

### 1.1 核心基建

| 模块 | 选型 | 版本策略 | 说明 |
|---|---|---|---|
| 框架 | Vue 3（Composition API + `<script setup>`） | 最新稳定版（非 beta/rc） | 你偏好的前端主框架 |
| 构建工具 | Vite | 最新稳定版 | HMR 快、配置少，与 Vue 生态原生匹配 |
| 类型系统 | **TypeScript**（已决策 D3-B 推荐项） | `vue-ts` 模板 | 与 Java 后端思维对齐，利于长期维护 |
| CSS 引擎 | Tailwind CSS 3（JIT 模式） | 3.x 稳定版 + 配套 PostCSS / Autoprefixer | 你已熟悉，避免重新学习 |
| 包管理器 | NPM | 跟随 Node 24.11.1 内置 | 不混用 pnpm/yarn，降低环境差异 |

### 1.2 组件 & 工具生态

| 模块 | 选型 | 说明 |
|---|---|---|
| 无样式组件层 | **shadcn-vue** | Radix-vue 封装，可直接复制进 `src/components/ui`，高可定制 |
| 响应式 & 工具集 | **VueUse** | 覆盖 90% 常见组合式需求（深色模式、媒体查询、localStorage 等） |
| 图标库 | **lucide-vue-next** | 现代风格 SVG 图标，与极简风契合度最高 |
| 等宽字体 | **JetBrains Mono**（@fontsource 引入） | Hero 终端 + 代码块 + 技术标签统一使用 |
| 页面动效 | **GSAP**（首屏 2-3 个滚动出场动效） | 时间线可控，兼容 prefers-reduced-motion |
| 3D 背景 | **Vanta.js**（决策点 D1-A） | 轻量（~50KB）、无 Three.js 强依赖、5 种效果任选；性能优于 TresJS 首屏 |
| 路由 | **vue-router 4**（History 模式） | 6 条路由 + 404 兜底 |
| 状态管理 | 暂不引入 Pinia | 首版仅 5 个静态页面 + 深浅色切换，用 VueUse + reactive 足够；后续有复杂状态再补 |

### 1.3 暂不引入（等 MVP 后评估）

- Pinia（首版状态量不够）
- SEO / Nuxt（先 CSR 跑出效果，后续迁 SSR）
- i18n 多语言
- Capacitor 移动端打包
- 后端 FastAPI + 数据库（先用 Mock JSON）

---

## 2. 目录结构约定

首版目录树如下，**新增文件必须遵循分层**，禁止随意在根目录堆放组件。

```
personal-site/
├── devlogs/                          ← 开发日志目录（用户偏好约定）
│   ├── in_progress.md                ← 会话进行中临时日志，会话结束重命名归档
│   └── 20260823_项目初始化与文档编写.md   ← 归档示例
├── public/                           ← 静态资源（favicon、robots.txt、OG 图等）
├── src/
│   ├── assets/                       ← 需 Vite 处理的静态资源（SVG sprite、图片导入）
│   ├── components/                   ← 通用 & 业务组件
│   │   ├── ui/                       ← shadcn-vue 生成的无样式原子组件（Button/Card/Input...）
│   │   ├── layout/                   ← 全局布局组件：Header / Footer / ThemeToggle / MobileDrawer
│   │   ├── hero/                     ← 首屏 Hero 相关：TerminalCard / TypewriterText / CtaButtons
│   │   ├── background/               ← 3D 背景与降级层：VantaBackground / GradientFallback
│   │   ├── about/                    ← 关于我页面子组件
│   │   ├── projects/                 ← 作品集页面子组件
│   │   ├── blog/                     ← 博客页面子组件
│   │   ├── timeline/                 ← 经历时间线子组件
│   │   └── contact/                  ← 联系方式子组件
│   ├── composables/                  ← 组合式函数（useTheme、useTypewriter、useScrollReveal）
│   ├── data/                         ← Mock 数据（JSON 或 TS 对象）
│   │   ├── profile.ts                ← 个人信息
│   │   ├── projects.ts               ← 作品集列表
│   │   ├── posts.ts                  ← 博客文章列表
│   │   ├── timeline.ts               ← 经历时间线
│   │   └── social.ts                 ← 社交链接
│   ├── layouts/                      ← 页面级布局
│   │   └── AppLayout.vue             ← 主布局（Header + <RouterView> + Footer + 全局背景层）
│   ├── pages/                        ← 路由对应的页面入口（只负责拼装子组件，不含复杂逻辑）
│   │   ├── HomePage.vue              ← 首页 = Hero 终端 + 项目精选 CTA
│   │   ├── AboutPage.vue
│   │   ├── ProjectsPage.vue
│   │   ├── BlogPage.vue
│   │   ├── TimelinePage.vue
│   │   ├── ContactPage.vue
│   │   └── NotFoundPage.vue          ← 404
│   ├── router/
│   │   └── index.ts                  ← 路由表 + 路由守卫（暂无权限，预留）
│   ├── styles/                       ← 全局样式（而非散落在组件内）
│   │   ├── index.css                 ← @tailwind 指令入口
│   │   ├── tokens.css                ← 设计系统 CSS 变量（深浅色两套）
│   │   └── typography.css            ← 字体栈、标题层级、代码块样式
│   ├── App.vue                       ← 仅挂载 AppLayout + 路由切换动效
│   ├── main.ts                       ← 应用入口 + 全局背景组件挂载
│   ├── env.d.ts                      ← Vite + shadcn-vue + .vue 类型声明
│   └── shims-vue.d.ts                ← （如需）补充模块声明
├── .gitignore
├── components.json                   ← shadcn-vue 生成：ui 组件输出路径、别名、tailwind 配置路径
├── index.html
├── package.json
├── package-lock.json
├── postcss.config.js
├── tailwind.config.ts                ← 含 design tokens extend + content 扫描路径
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts                    ← 路径别名 @ → src
└── PROJECT_PLAN.md                   ← 本方案文档
```

---

## 3. 设计系统（落地顺序 = T02）

### 3.1 主题色板（紫色风，与 UI UX Pro Max Skill 对齐）

深浅色通过 `class="dark"` 切换 + CSS 变量覆盖实现，首次访问跟随系统 `prefers-color-scheme`，后续以 localStorage 为准。

**主色（紫色系 Trae 风）**
- 品牌色：`#4B3FE3`（亮） / `#6054F1`（暗）
- 浅色填充：`#F2F7FF` / `#E5EAFF`
- 深色填充：`#1A1759` / `#3C2ECA`

**中性色**
- 背景（亮）：`#F7F7F8` / 次级 `#EFEFF2`
- 背景（暗）：`#0F0F10` / 次级 `#1A1A1D`
- 文字（亮）：`#171717` / 次级 `#52525B`
- 文字（暗）：`#E5E5E5` / 次级 `#A1A1AA`
- 边框：半透明 rgba，不使用纯黑/纯白硬边

**语义色（仅用于明确状态）**
- 成功绿 `#1DC981`、警告黄 `#EFAA17`、危险红 `#E8463A`

### 3.2 字体栈（双轨制）

```
正文栈（--font-sans）：
  "SF Pro Text" → "PingFang SC" → system-ui → -apple-system → "Segoe UI" → Roboto

等宽/代码栈（--font-mono）：
  "JetBrains Mono" → ui-monospace → "SF Mono" → Menlo → Consolas → monospace

数字/指标栈（--font-metric）：
  "Inter" → 正文栈（等宽数字 tabular-nums）
```

字体引入：`@fontsource/jetbrains-mono`，Inter 通过 Google Fonts 或 @fontsource。

**字号层级（最大 16px，遵循 inline-widget 同构规范）**
- 标题 16px/24px（card title、页面主标题）→ 由 `clamp()` 在大屏可适度放大
- 正文 14px/20px
- 辅助/标签 12px/18px
- 代码/ID 13px/20px（JetBrains Mono）

### 3.3 间距与圆角（与 Tailwind 默认值对齐，自定义项在 extend 中）

- 间距：`4/8/12/16/20/24/32/48/64`（px 或 Tailwind 的 `sp-*`）
- 圆角：8px（组件）/ 12px（卡片）/ 999px（胶囊/圆形）
- 阴影：克制使用，仅用于悬浮卡片弹出态，不搞大投影

### 3.4 响应式断点（沿用 Tailwind 默认，不自定义）

```
sm  ≥ 640px   手机横屏
md  ≥ 768px   平板竖屏（移动端汉堡菜单切桌面导航的断点）
lg  ≥ 1024px  平板横屏/小屏笔记本
xl  ≥ 1280px  常规桌面
2xl ≥ 1536px  大屏（内容最大宽度居中，两侧留白）
```

内容最大宽度：`max-w-6xl`（~1152px）居中，保证大屏阅读区不过宽。

---

## 4. 路由与页面清单（落地顺序 = T04 + T05）

### 4.1 路由表（vue-router History 模式）

| 路径 | 组件 | 说明 |
|---|---|---|
| `/` | `HomePage.vue` | 首页 = Hero 终端 + 精选作品 3 张 + 底部 CTA |
| `/about` | `AboutPage.vue` | 关于我：个人卡 + 技能矩阵 + 价值观/兴趣 |
| `/projects` | `ProjectsPage.vue` | 作品集：筛选标签 + 卡片网格 + 详情模态占位 |
| `/blog` | `BlogPage.vue` | 博客：文章列表 + 标签筛选 + 搜索占位（无详情页，首版链接占位） |
| `/timeline` | `TimelinePage.vue` | 经历时间线：教育 / 工作 / 开源 合并时间轴 |
| `/contact` | `ContactPage.vue` | 联系方式：社交矩阵 + 邮箱卡片 + 留言表单（纯前端校验占位，无后端提交） |
| `/:pathMatch(.*)*` | `NotFoundPage.vue` | 404 兜底：返回首页按钮 + 趣味终端风格提示 |

### 4.2 每个页面最低内容要求（T05 验收项）

**AboutPage**
- 头像（用占位图服务，首版不跑真实图生成管线）
- 姓名 + 身份 + 一句话签名
- 个人简介 2-3 段
- 技能矩阵（按「语言 / 框架 / 基建 / 其他」分组，标签 + 熟练度条）
- 兴趣/价值观 3-5 个卡片

**ProjectsPage**
- 顶部：筛选标签（全部 / 前端 / 后端 / 全栈 / 开源）
- 卡片网格 ≥ 3 个项目
- 每张卡片：封面 + 标题 + 1 句描述 + 技术栈标签（3-5 个） + 链接按钮组（GitHub / Live Demo / 文章详情占位）
- 空状态占位（筛选无结果）

**BlogPage**
- 文章列表 ≥ 5 篇
- 列表项：标题 + 摘要 + 发布日期 + 阅读时长 + 标签 + 封面
- 顶部：标签筛选（全部 / 前端 / 后端 / 随笔）+ 搜索框（占位）
- 分页占位（或「加载更多」按钮占位）

**TimelinePage**
- 垂直时间轴，节点 ≥ 6 个
- 每个节点：日期 + 标题 + 机构/公司 + 描述 + 类别标签（教育/工作/开源）
- 类别标签颜色区分（3 色以内）

**ContactPage**
- 社交链接矩阵（GitHub / 邮箱 / 微信占位 / LinkedIn / 知乎 / 博客站）+ 图标 + hover 态
- 邮箱卡片（邮箱地址 + 复制按钮）
- 留言表单（姓名/邮箱/主题/留言四字段 + 前端非空/邮箱格式校验 + 「暂未接入后端」友好提示 + 禁用提交按钮）

---

## 5. Hero 终端首屏方案（落地顺序 = T06，纯展示模式 D2-A）

### 5.1 视觉结构

左右布局（md 及以上）/ 上下布局（sm 移动端）：
- 左/上：**终端模拟器卡片**（macOS 红黄绿按钮 + 黑色/暗色玻璃拟态背景 + JetBrains Mono）
- 右/下：**文案 + CTA 按钮组**

### 5.2 终端内容（打字机输出，纯展示不交互）

启动后延迟 300ms 开始逐行打印，总共 6-8 行，每行打完停 200-400ms：

```
$ whoami
<你的姓名> — 全栈开发者 / 技术爱好者 / 开源贡献者

$ cat about.txt
→ 主修：Java 后端 + Vue 3 前端 + 分布式系统
→ 偏好：极简风 + 功能感 + 类型安全
→ 正在构建：这个个人站 + 若干 Side Project

$ ls ./projects/
  [01] personal-site       (当前这个站)
  [02] distributed-id-gen  (分布式 ID 生成器)
  [03] ...                 (2-4 个精选项目占位)

$ open ./contact
  → email:    <你的邮箱占位>
  → github:   @TE-Fire

$ _ (光标闪烁)
```

> 注：所有 `<占位>` 内容在 T05 写 Mock 数据时统一配置，不写死在组件里。

### 5.3 CTA 按钮组（右侧/下方）

- 主按钮（紫色填充）：`查看作品集` → 跳 `/projects`
- 次按钮（描边）：`联系我` → 跳 `/contact`
- 幽灵按钮：`下载简历` → 占位（点击提示「简历 PDF 待上传」）
- 移动端 CTA 必须独立一行，保证可点区域 ≥ 44px

---

## 6. 3D 背景 + 滚动动效方案（落地顺序 = T07）

### 6.1 Vanta.js 选型（D1-A）

**效果优先级**：推荐先用 `NET`（网点连线，科技感强，性能开销最低）；后续可在配置层切 `BIRDS` / `WAVES` 快速替换主题，无需改代码。

**关键参数**：
- 半透明 + 低对比度，保证文字可读（不能喧宾夺主）
- 帧率上限 30fps，`resize` 防抖
- 组件销毁时必须 `instance.destroy()` 释放内存

### 6.2 降级策略（强制实现，不可跳过）

以下任一条件命中 → 自动降级为**纯色/渐变背景**，不加载 Vanta.js 脚本：

1. `matchMedia('(prefers-reduced-motion: reduce)').matches === true`
2. 移动端（`window.innerWidth < 768`）
3. `navigator.hardwareConcurrency < 4`（CPU 核心数不足）
4. 首屏加载后 3 秒内 FPS 持续 < 30（可选，通过 PerformanceObserver 观测）

降级层做 15s 缓慢呼吸渐变，保证不是「死图」但也不消耗算力。

### 6.3 GSAP 滚动动效（首版 ≤ 3 种，不贪多）

1. **About 个人卡**：滚入视口时 `translateY(20px) + opacity 0→1`，300ms
2. **Projects 卡片网格**：stagger 每张 60ms 渐入，统一 easing `power2.out`
3. **Timeline 节点**：沿时间线方向（上→下）逐个出现，节点和连线用不同的延迟

所有动效注册 `ScrollTrigger` 时必须 `toggleActions: "play none none reverse"`，且只在 `prefers-reduced-motion: no-preference` 时启用。

---

## 7. Git 提交规范（全流程强制）

### 7.1 提交粒度

= 1 条 Todo = 1 次或多次 commit，但**绝不跨任务堆积**。例如 T01 结束至少有 1 个 commit，再进入 T02。

### 7.2 提交信息格式（全中文，用户偏好约定）

```
<类型>(<模块>): <一句话描述，不超过 50 字>

[可选：空行 + 详细说明，列出关键改动点 1-3 条]
```

**类型枚举**：
- `feat`：新功能 / 新页面 / 新组件
- `fix`：修 bug
- `docs`：文档（PROJECT_PLAN.md、devlogs、README）
- `style`：纯样式调整（非功能，如改色板、间距）
- `refactor`：重构（不改功能、不改行为）
- `perf`：性能优化
- `chore`：脚手架、依赖、配置文件变动
- `init`：首次初始化（仅 T01 用一次）

**模块枚举**（与目录对应）：
- `repo`：仓库级（gitignore、分支策略、CI）
- `plan`：方案文档
- `scaffold`：脚手架/T01
- `design`：设计系统/T02
- `deps`：依赖安装/T03
- `layout`：全局布局/T04
- `pages`：页面/T05
- `hero`：首屏 Hero/T06
- `motion`：背景+动效/T07
- `verify`：验证交付/T08

**示例（本方案对应的前几个 commit）**：
```
chore(repo): 初始化 git 仓库并关联远程 origin

docs(plan): 新增 PROJECT_PLAN.md v1.0 方案文档

docs(logs): 新建 devlogs/in_progress.md 会话日志

init(scaffold): 创建 Vue3+Vite+TS 项目脚手架 + Tailwind 接入
```

### 7.3 推送策略

- **HTTPS 协议**（origin 当前配置）：推送前依赖 Git Credential Manager 或 PAT；若遇到认证阻塞，**立刻停等你提供凭据**，不反复重试避免触发风控
- 每完成一个 Todo 至少 commit 一次；push 节奏：T00-T02 做完推送一次，T03-T05 做完推送一次，T06-T08 做完推送一次
- 禁止 rebase 已推送到远端的提交

---

## 8. 验收标准（T08 交付 Checklist）

### 8.1 构建与运行

- [ ] `npm install` 无致命错误
- [ ] `npm run build` 零 TypeScript 错误 + 零 Vite 错误 + 控制台 WARNING 数量 ≤ 3
- [ ] `npm run dev` 启动后控制台无 Vue/路由/Tailwind 报错
- [ ] 本地预览端口占用时能自动切换相邻端口

### 8.2 路由与页面

- [ ] 6 条路由全部可访问（/、/about、/projects、/blog、/timeline、/contact）
- [ ] 不存在的路由跳 /404（或显示 NotFound 组件）
- [ ] Header 导航高亮与当前路由匹配
- [ ] 浏览器前进/后退无报错

### 8.3 响应式 & 主题

- [ ] 桌面（≥1280px）：6 页面布局无错位，内容最大宽度 ≤ max-w-6xl
- [ ] 平板（768-1024px）：导航能正常切换、卡片网格降级为 2 列
- [ ] 手机（<768px）：汉堡菜单可开合、CTA 按钮单列、无横向滚动条
- [ ] 深色/浅色切换按钮：即时生效 + 刷新后保持 + 首次访问跟随系统

### 8.4 Hero & 动效

- [ ] Hero 终端打字机顺序跑完后光标持续闪烁
- [ ] CTA 三个按钮跳转正确（下载简历提示合理）
- [ ] Vanta.js 背景在桌面可见（无明显掉帧），在 `prefers-reduced-motion: reduce` 下回退为渐变
- [ ] 3 处 GSAP 滚动动效只在滚入时触发，回滚不卡顿

### 8.5 设计系统一致

- [ ] 全站点色板仅有：紫色主色系 + 中性色 + 3 个语义色（无「五颜六色」的卡片）
- [ ] 字号 ≤ 16px（除 H1/Hero 用 clamp 放大外）
- [ ] 圆角、间距全部走 Tailwind token，无 inline 硬编码 `style="padding: 10px"`

### 8.6 Git & 文档

- [ ] 目录结构与本方案 §2 一致（无乱放的文件）
- [ ] 至少 7 个有效 commit（T00→T08 每阶段至少一个）
- [ ] devlogs 目录存在、含会话日志
- [ ] PROJECT_PLAN.md 存在并与实际代码对应（若代码偏离方案，文档已同步更新）

---

## 9. 已知风险与应对

1. **ui-ux-pro-max CLI 无法安装或命令失败（T02）** → 回退方案：按 Skill 文档手动落地同等 token（字体/配色/圆角/组件约束），保证视觉契约不打折，CLI 只是辅助工具。
2. **Vanta.js 与新版本 Vue 兼容性问题（T07）** → 备选效果：用 Three.js 原生写一个极简粒子场（~100 行），或降级为「渐变 + CSS 动画噪点」。
3. **shadcn-vue init 交互式问题卡住（T03）** → 提前准备好 `components.json` + 手动复制 Button/Card/Input 等 5 个最常用组件的源码，不走 CLI 自动模式。
4. **Git 推送认证失败（全局）** → 一次性给你操作步骤：GitHub 生成 PAT → Windows 凭据管理器添加 → 重试 push；或切换 SSH（一次性给你公钥内容粘贴）。

---

## 10. 后续可扩展项（MVP 交付后再讨论，不进首版）

- SEO：迁 Nuxt 或使用 `vite-plugin-vue-seo` + 预渲染首屏 3 页
- 后端接入：Python FastAPI + MySQL/Redis，把 Mock 数据替换成真实 API
- 评论系统：Giscus（GitHub Discussions）或 Waline
- 站点分析：Umami / Plausible（无 Cookie）
- PWA：添加 Service Worker，离线可访问
- Capacitor：打包 Android/iOS App（你已在技术栈中列出 Capacitor）
- 多语言：zh-CN / en-US 两套文案 + i18n Route
