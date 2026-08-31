# 个人站点 · 项目开发规格说明

> 本文档以前端现有代码为原型，逐模块反推后端数据表与接口设计。
> 每个模块独立分析，按开发优先级逐步补充。

---

## 模块开发顺序

| 序号 | 模块 | 状态 | 说明 |
|------|------|------|------|
| 1 | Auth 认证 | ✅ 已完成 | 博主登录 / 游客只读，不开放注册；滑块验证码 + JWT；接口 `/auth/captcha` `/auth/login` `/auth/profile` `/auth/change-password` |
| 2 | **User 账号资料** | ✅ 已完成 | 博主账号自我管理：`GET/POST /users/me`（nickname/email）、`POST/DELETE /users/avatar`（本地上传 5MB 4 格式）。Header 下拉菜单 + `/profile` 页面 |
| 3 | **About 关于我展示** | 📝 本章节分析 | **前端写死数据 → 后端动态化**。公开页面 `/about` + 首页 Hero + 悬浮迷你卡片 共 3 处消费 About 字段。本文档分析 → 扩表 → About 模块接口 → 前端改造 → Profile 页加 Tab 编辑器 |
| 4 | **Post 文章** | 📝 本章节分析 | 核心实体，关联 Category + Tag；逻辑外键 `relationMode=prisma`；Markdown 存 TEXT 前端渲染 |
| 5 | Category 分类 | 📝 本章节含 | Post 章节内一并设计（严格关系模型独立表） |
| 6 | Tag 标签 | 📝 本章节含 | Post 章节内一并设计（全局唯一 + 多对多中间表） |
| 7 | Life 生活碎片 | ⬜ 待分析 | 照片 / 音乐 / 随笔 |

---

## 模块一：Auth 认证

### 1.1 需求概述

| 角色 | 权限 | 说明 |
|------|------|------|
| 博主 (admin) | 全部 CRUD | 登录后可创建/编辑/删除文章、分类、标签 |
| 游客 (guest) | 只读已发布 | 无需登录，浏览文章/分类/标签列表 |
| 注册 | 不开放 | 不提供 `/auth/register` 接口 |

### 1.2 前端现状分析

| 维度 | 现状 | 需要新增/改造 |
|------|------|-------------|
| 登录页面 | 无 | 新建 `LoginPage.vue`（含验证码） |
| 验证码 | 无 | 前端滑块/图形验证码组件 + 后端验证码生成与校验 |
| 路由守卫 | 仅 `afterEach` 设标题，无 `beforeEach` | 新增 `beforeEach` 检查 `meta.requiresAuth` |
| HTTP 客户端 | 无 axios，数据全走 localStorage | 引入 axios + 请求拦截器（注入 Bearer Token） |
| Token 存储 | 无 | localStorage `auth_token` + Pinia store |
| 用户信息展示 | Header 无用户区域 | Header 右侧加博主头像/昵称 + 登出入口 |
| 状态管理 | 无 Pinia store | 新建 `useAuthStore` 管理登录态 |

### 1.3 前端 UI 设计

#### 页面：LoginPage.vue

| 区域 | 设计 | 组件 |
|------|------|------|
| 背景层 | 复用 Vanta.js NET 动画（紫色主题） | 已有 Vanta 集成 |
| 登录卡片 | 居中毛玻璃卡片 `backdrop-blur-xl bg-surface/85` | shadcn `Card` + `CardHeader` + `CardContent` |
| 用户名 | 带图标输入框，`lucide User` 图标 | shadcn `Input` + `Label` |
| 密码 | 带图标输入框，`lucide Lock` 图标，可切换显示 | shadcn `Input` + `Eye/EyeOff` 图标切换 |
| 验证码 | 滑块拼图（推荐）或图形字符验证码，点击可刷新 | 自定义 `SlideCaptcha.vue` 或 `CaptchaImage.vue` |
| 登录按钮 | 紫色主题 `bg-brand text-white`，loading 状态 | shadcn `Button` + `Loader2` 旋转图标 |
| 错误提示 | 红色文字 + `AlertCircle` 图标 | shadcn `Alert` |
| 路由 | `/login`，`meta: { requiresAuth: false, title: '登录' }` | vue-router |

#### 验证码方案对比

| 维度 | 方案 A：滑块拼图验证码（推荐） | 方案 B：图形字符验证码 |
|------|------------------------------|----------------------|
| 交互方式 | 拖动滑块拼合缺口 | 输入图片中的字符 |
| 用户体验 | 拖拽操作直觉化，无字符辨认困难 | 偶尔字符难辨认，需刷新 |
| 视觉风格 | 与项目 3D 科技调性高度匹配 | 传统风格，略显普通 |
| 前端实现 | 自定义组件 `SlideCaptcha.vue`，Canvas 绘制 + 鼠标拖拽 | `<img>` 标签 + 刷新按钮 |
| 后端生成 | `sharp` 裁剪背景图生成缺口 + 随机偏移 | `svg-captcha` 生成 SVG 字符图片 |
| 后端校验 | 校验滑块拖动 x 坐标（±5px 容差） | 校验用户输入字符（忽略大小写） |
| 存储 | Redis 或内存 Map：`captchaId → targetX` | Redis 或内存 Map：`captchaId → text` |
| 防暴力 | 拖拽轨迹分析可加行为校验 | 仅防 OCR 识别 |
| 学习价值 | 高（Canvas + 图片处理 + 交互设计） | 中（SVG 生成 + 字符校验） |

> **推荐方案 A**：滑块拼图验证码。理由：与项目紫色科技调性匹配、用户体验好、学习价值高。
> 方案 B 作为备选，开发成本更低，可快速上线。

#### 滑块验证码 UI 细节（方案 A）

| 子区域 | 设计 | 交互 |
|--------|------|------|
| 背景画布 | 300×180px Canvas，渲染随机背景图 | 从后端获取 base64 图 |
| 缺口层 | Canvas 叠加半透明缺口块 | 后端返回缺口位置（前端不可见） |
| 滑块 | 底部 40px 高滑轨 + 拼图块 | 鼠标/触摸拖动，松开校验 |
| 状态提示 | 滑轨左侧灰色文字「拖动滑块完成验证」 | 成功变绿「验证通过」，失败变红抖动 |
| 刷新 | 右上角 `lucide RefreshCw` 图标按钮 | 点击重新获取验证码 |

#### Header 改造

| 区域 | 设计 | 组件 |
|------|------|------|
| 未登录态 | 不显示用户区域（游客无感知） | 无 |
| 已登录态 | 头像（圆形 `size-8`）+ 昵称 + 下拉菜单 | shadcn `DropdownMenu` |
| 下拉菜单 | 「管理后台」跳转 + 「退出登录」 | shadcn `DropdownMenuItem` + `lucide LogOut` 图标 |
| 入口位置 | Header 右侧，主题切换按钮左边 | |

#### 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | Vue 3 + TypeScript | ^3.5 |
| UI 组件库 | shadcn-vue | 已集成 |
| 图标库 | lucide-vue-next | 已集成 |
| 路由 | vue-router | ^4 |
| 状态管理 | Pinia | ^2（需新增） |
| HTTP 客户端 | axios | ^1.7（需新增） |
| 滑块验证码 | Canvas 2D API + 自定义 Vue 组件 | 原生实现 |
| 样式 | Tailwind CSS | 已集成 |

### 1.4 后端接口设计

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/auth/captcha` | 无 | 生成滑块验证码：返回背景图 + 缺口图 + captchaId |
| `POST` | `/api/auth/login` | 无 | 用户名密码 + 验证码校验，返回 JWT |
| `GET` | `/api/auth/profile` | 需登录 | 获取当前登录用户信息 |
| `POST` | `/api/auth/logout` | 需登录 | 可选：服务端可选记录（JWT 无状态，前端删 Token 即可） |

#### 验证码接口

**GET /api/auth/captcha**

成功响应（200）：
```json
{
  "code": 200,
  "data": {
    "captchaId": "a1b2c3d4-e5f6-7890",
    "bgImage": "data:image/png;base64,iVBORw0KG...",
    "puzzleImage": "data:image/png;base64,iVBORw0KG...",
    "canvasWidth": 300,
    "canvasHeight": 180,
    "puzzleSize": 48
  },
  "message": "success"
}
```

> 后端将 `captchaId → targetX` 存入 Redis 或内存 Map，TTL 5 分钟。
> `targetX` 是缺口正确位置（前端不可见）。

#### 登录接口（含验证码）

**POST /api/auth/login**

请求体：
```json
{
  "username": "admin",
  "password": "your-password",
  "captchaId": "a1b2c3d4-e5f6-7890",
  "slideX": 127
}
```

成功响应（200）：
```json
{
  "code": 200,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 604800,
    "tokenType": "Bearer"
  },
  "message": "登录成功"
}
```

失败响应（400）：
```json
{
  "code": 1004,
  "data": null,
  "message": "用户名或密码错误"
}
```

验证码校验失败响应（400）：
```json
{
  "code": 1006,
  "data": null,
  "message": "验证码校验失败，请重试"
}
```

> 验证码校验失败后，后端删除该 captchaId，前端需重新获取验证码。

**GET /api/auth/profile**

成功响应（200）：
```json
{
  "code": 200,
  "data": {
    "id": 1,
    "username": "admin",
    "nickname": "TE-Fire",
    "email": "admin@example.com",
    "avatar": "https://...",
    "role": "admin"
  },
  "message": "success"
}
```

### 1.5 数据库表设计

#### 表：user

```sql
CREATE TABLE `user` (
  `id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `username`    VARCHAR(50)     NOT NULL                COMMENT '登录用户名',
  `password`    VARCHAR(100)   NOT NULL                COMMENT 'bcrypt 哈希密码',
  `nickname`    VARCHAR(50)    NOT NULL                COMMENT '展示昵称',
  `email`       VARCHAR(100)   DEFAULT NULL            COMMENT '邮箱（可选）',
  `avatar`      VARCHAR(255)   DEFAULT NULL            COMMENT '头像 URL',
  `role`        VARCHAR(20)    NOT NULL DEFAULT 'admin' COMMENT '角色：admin',
  `created_at`  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表（仅博主一条记录）';
```

#### 种子数据

```sql
-- 密码明文：your-password，bcrypt cost=10
INSERT INTO `user` (`username`, `password`, `nickname`, `email`, `role`)
VALUES (
  'admin',
  '$2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  'TE-Fire',
  'admin@example.com',
  'admin'
);
```

> bcrypt 哈希值在 `prisma db seed` 时由 Node 脚本动态生成，不写死。

### 1.6 后端技术方案

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | NestJS | ^10.4 | 应用框架 |
| 语言 | TypeScript | ^5.5 | 类型安全 |
| ORM | Prisma | ^5.19 | 数据库访问层 |
| 数据库 | MySQL | 8.0 | 持久化 |
| 密码哈希 | bcrypt | ^5.1 | 密码加密/校验 |
| 图片处理 | sharp | ^0.33 | 验证码背景图裁剪 + 缺口生成 |
| JWT | @nestjs/jwt + passport-jwt | ^10.2 / ^4.0 | Token 签发与验证 |
| 验证 | class-validator + class-transformer | ^0.14 / ^0.5 | DTO 参数校验 |
| API 文档 | @nestjs/swagger | ^7.4 | Swagger UI |
| 安全 | helmet | ^7.1 | HTTP 安全头 |
| 验证码存储 | 内存 Map（开发期）/ Redis（生产期） | - | captchaId → targetX，TTL 5min |

#### 核心流程

```
登录流程（含验证码）：
  1. 前端 GET /auth/captcha
     → CaptchaService.generate()
     → sharp 读取随机背景图，随机位置裁剪出拼图块
     → 生成 captchaId（UUID），将 targetX 存入内存 Map（TTL 5min）
     → 返回 {captchaId, bgImage(base64), puzzleImage(base64), 尺寸参数}

  2. 前端渲染滑块验证码组件，用户拖动滑块

  3. 前端 POST /auth/login {username, password, captchaId, slideX}
     → AuthService.login()
     → 先校验验证码：内存 Map 取出 targetX，判断 |slideX - targetX| <= 5
     → 验证码校验通过后删除 Map 中的 captchaId（一次性）
     → Prisma user.findUnique({username})
     → bcrypt.compare(password, user.password)
     → JwtService.sign({sub: user.id, role: user.role})
     → 返回 {accessToken, expiresIn, tokenType}

请求鉴权流程：
  前端请求 Header: Authorization: Bearer <token>
    → JwtAuthGuard → JwtStrategy.validate()
    → 解析 payload {sub, role}
    → Prisma user.findUnique({id: sub})
    → 注入 req.user = UserVo
    → Controller 方法可访问 req.user
```

#### 权限守卫设计

```typescript
// 1. JwtAuthGuard — 强制登录（博主专属接口）
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('posts')
// POST/PUT/DELETE 方法标注

// 2. OptionalJwtAuthGuard — 游客可访问，博主可看草稿
//   GET /posts 列表：游客只看 published，博主看全部
//   实现方式：Guard 不拦截，Controller 内判断 req.user?.role
```

### 1.7 前后端对接清单

| 序号 | 前端任务 | 后端任务 |
|------|----------|----------|
| 1 | 安装 axios + pinia | 安装 bcrypt + sharp |
| 2 | 新建 `src/lib/axios.ts` 请求拦截器 | 实现 `CaptchaService.generate()` 滑块验证码生成 |
| 3 | 新建 `src/stores/auth.ts` Pinia store | 实现 `CaptchaService.verify()` 校验逻辑 |
| 4 | 新建 `SlideCaptcha.vue` 滑块验证码组件 | 实现 `AuthService.login()` 含验证码校验 |
| 5 | 新建 `LoginPage.vue` 登录页（集成验证码） | 替换 mock 登录逻辑 |
| 6 | `router/index.ts` 添加 `/login` 路由 + `beforeEach` 守卫 | - |
| 7 | `Header.vue` 添加已登录态用户区域 | - |
| 8 | 博客编辑器页加 `meta.requiresAuth = true` | - |
| 9 | 请求拦截器：Token 过期 401 → 跳登录页 | JWT 签发有效期 7d |
| 10 | 验证码组件：拖拽完成 → 登录按钮可点击 | 验证码一次性消费，校验后删除 captchaId |

### 1.8 Prisma Schema（预览）

```prisma
model User {
  id        Int      @id @default(autoincrement())
  username  String   @unique
  password  String
  nickname  String
  email     String?
  avatar    String?
  role      String   @default("admin")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // 关联（后续模块补充）
  // posts     Post[]
}
```

---

## 模块三：About · 关于我公开展示

> **目标**：把前端 `src/data/about.ts` 中写死的 `aboutMe` + `skillGroups` 数据改为从后端动态拉取，
> 并提供 admin 管理端（Profile 页 Tab 编辑器）可随时编辑保存。
> 公开接口免登录（游客看 `/#/about` 页面不用鉴权）。

### 3.1 需求概述

| 角色 | 权限 | 说明 |
|------|------|------|
| 游客 (guest) | 只读公开 About | 浏览 About 页面 / 首页 Hero 展示 / 左下角迷你卡片 |
| 博主 (admin) | 读 + 改 | 登录后通过 `/profile` 页「关于我展示」Tab 编辑所有字段 |
| 新增字段总数 | — | 8 个标量列 + 5 个 JSON 列（见 3.3 总表） |

### 3.2 前端页面 × 区域 × 字段 拆解（按 UI 组件来源反推）

前端 About 数据目前有 **3 个消费页/组件**，共 **11 个渲染区域**。
下方表是逐行拆出来的「哪个 UI 元素 → 绑定哪个字段 → 字段形态」。

#### 消费端 1：`AboutPage.vue`（`/#/about`，公开页面，核心消费端）

| 区域编号 | UI 区域 | 绑定字段 | 形态 | 截图对应位置 |
|----------|---------|----------|------|--------------|
| A-1 | 圆形头像（首字母渐变图，可扩展为真实 avatar） | `name`（取 charAt(0)）**+ 可复用 `avatar`** | string | 页头左侧 28×28 圆形 |
| A-2 | Hi, I'm **Trae** 标题 | `name` | string，≤50 | 页头右侧大标题 |
| A-3 | 副标题短简介 | `shortBio` | string，≤300 | 标题下方正文 |
| A-4 | 位置（MapPin 图标） | `location` | string，≤100 | A-3 下方小 chips |
| A-5 | 状态「可接项目 / 排期满」+ 心跳指示点 | `available` | boolean | 同 A-4 行 |
| A-6 | 4 个高亮统计数字卡片（5+/20+/3.2k/8k） | `highlightStats[]` | `{label:string, value:string}[]`，常长 4 项，JSON | 页头下方 2×2 grid |
| A-7 | 长文介绍 1~3 段 | `longBio[]` | `string[]` 段落数组，JSON | Section 4 「关于我」 |
| A-8 | 技能分组 3 组：主技术栈/熟悉/工具链 | `skillGroups[]` | `{id:string, title:string, variant:string, items:string[]}[]`，JSON | Section 6 技能栈 |
| A-9 | 最近感兴趣 chip 列表（6 颗） | `interests[]` | `string[]`，JSON | Section 7 底部 |
| A-10 | 「现在在做什么」Card —— 2026 下半年 3 条文字（目前组件写死，建议也入库） | `nowDoing[]` | `string[]`（支持 **粗体内嵌 markdown** `**xxx**`），JSON | Section 5 Card |

#### 消费端 2：`HomePage.vue`（`/#/`，首页 Hero）

| 区域编号 | UI 区域 | 绑定字段 | 备注 |
|----------|---------|----------|------|
| H-1 | 副标题：「Trae · full-stack vibe coder based in 中国」 | `name` + `location.split(' · ')[0]` | 复用，不新增 |
| H-2 | 终端打字 2 行：「方向：Vue 3 生态 / TS 工程化 / ...」 | `tags[]`（前 4 项） | `string[]`，JSON，建议固定 4 项，新增字段 |
| H-3 | 短简介段落 | `shortBio` | 与 About A-3 复用 |
| H-4 | 状态行：「目前可接单 · 远程协作友好 · UTC+8 · 中国」 | `available` + `location` | 与 About A-4/A-5 复用 |
| H-5 | 4 个统计 chip（5+/20+/3.2k/8k） | `highlightStats[]` | 与 About A-6 复用 |

#### 消费端 3：`DraggableStatsWidget.vue`（左下角悬浮迷你卡片）

| 区域编号 | UI 区域 | 绑定字段 | 备注 |
|----------|---------|----------|------|
| D-1 | 迷你卡片头像（首字母圆形） | `name.charAt(0)` | 与 A-1 复用 |
| D-2 | 在线状态绿色圆点 | `available` | 与 A-5 复用 |
| D-3 | 卡片底部：`TE-Fire` + `可接单 · 中国` | `name` + `available` + `location` | 全部复用，不新增 |

### 3.3 字段统一总表（User 表扩列方案 A）

> 说明：**与 User 模块的重叠字段**：`name` 可与 `nickname` 逻辑等价（显示名），头像直接复用 `avatar` 列。
> 其余 About 独有字段用独立列。下划线命名的 `about_*` 前缀只是"视觉分组"，不影响 SQL 查询。

| # | 字段（DB 列） | TS 类型 | Prisma/MySQL 类型 | 来源/消费位置 | 默认值（种子） |
|---|--------------|---------|-------------------|--------------|---------------|
| 0（复用） | `id` | number | Int @id @default(autoincrement()) | PK | — |
| 1（复用） | `nickname` | string | `VARCHAR(50)` NOT NULL | About: name / Home: name / Widget: name | `'Trae'` |
| 2（复用） | `avatar` | string \| null | `VARCHAR(255)` NULLABLE | About A-1 圆形头像（可升级成真实图片代替首字母） | `NULL` |
| 3 | `about_short_bio` | string | `VARCHAR(300)` NOT NULL | About A-3 / Home H-3 | 前端 shortBio 默认文案 |
| 4 | `about_long_bio` | string[] | `JSON` (MySQL JSON) | About A-7 段落数组 | 前端 longBio[] 3 段 |
| 5 | `about_skills` | SkillGroup[] | `JSON` | About A-8 技能 3 组 | 前端 skillGroups[] |
| 6 | `about_highlight_stats` | `{label:string,value:string}[]` | `JSON` | About A-6 / Home H-5 | 前端 highlightStats 4 项 |
| 7 | `about_interests` | string[] | `JSON` | About A-9 兴趣 chip | 前端 interests[] 6 项 |
| 8 | `about_tags` | string[] | `JSON`（约定固定 4 项） | Home H-2 终端「方向：xx / yy / zz / aa」 | 前端 tags[] 4 项 |
| 9 | `about_location` | string | `VARCHAR(100)` NOT NULL | About A-4 / Home H-1 & H-4 / Widget D-3 | `'中国 · 远程协作友好（UTC+8）'` |
| 10 | `about_available` | boolean | `BOOLEAN` NOT NULL @default(true) | About A-5 / Home H-4 / Widget D-2 | `true` |
| 11（新增） | `about_now_doing` | string[] | `JSON`（支持 `**粗体**` 语法） | About A-10「现在在做什么」Card | 4 条当前文案 |

**字段总数**：扩 `User` 表新增 **9 列**（1 varchar(300) + 1 varchar(100) + 1 boolean + 5×JSON + 标量等），其中 **3 列复用已有**（id/nickname/avatar）。

### 3.4 功能拆解

| 编号 | 功能 | 前端位置 | 后端接口 | 鉴权 |
|------|------|---------|---------|------|
| F-1 | About 公开数据读取 | `AboutPage.vue` mounted 时请求 1 次，缓存到 Pinia 全端共享 | **GET /api/about** | ✅ 无（公开） |
| F-2 | 首页 Hero 展示字段 | `HomePage.vue` onMounted，与 F-1 共用缓存 | GET /api/about（走缓存） | 无 |
| F-3 | 左下角悬浮迷你卡片 | `DraggableStatsWidget.vue` onMounted | GET /api/about（走缓存） | 无 |
| F-4 | 保存「关于我展示」全部字段 | `/profile` 页「关于我展示」Tab → 点「保存」 | **PUT /api/about** | 🔒 必须 admin |

### 3.5 后端接口设计

> 统一响应规范：`Result<T> = { code: number, message: string, data: T }`
> 接口前缀：`/api/about`

---

#### 接口 A：公开查询 About

**GET /api/about** — 游客 + admin 都能调

- **缓存建议**：响应加 `Cache-Control: max-age=60, public`（1 分钟缓存，改动后最多 1 分钟刷新生效）；避免游客高频访问打 DB。
- **实现逻辑**：Service 层直接 `prisma.user.findFirst({ select: { nickname, avatar, about_short_bio, ... } })` —— 因为系统只有 1 个博主用户，永远取第一条。

成功响应（200）：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "name": "Trae",
    "avatar": "/uploads/avatar/xxx.png",
    "shortBio": "一个热爱构建的前端工程师……",
    "longBio": ["2019 年从…", "过去 5 年…", "工作之外…"],
    "highlightStats": [
      { "label": "年前端经验", "value": "5+" },
      { "label": "上线项目数", "value": "20+" },
      { "label": "开源 Star", "value": "3.2k" },
      { "label": "月均博客字数", "value": "8k" }
    ],
    "location": "中国 · 远程协作友好（UTC+8）",
    "available": true,
    "tags": ["Vue 3 生态", "TypeScript 工程化", "设计系统与 UI 质感", "AI Agent 工作流"],
    "interests": ["设计系统", "AI Agent 工作流", "独立游戏", "字体与排版", "WebGL 视觉", "长期主义"],
    "skillGroups": [
      { "id": "proficient", "title": "主技术栈 · 熟练使用", "variant": "default", "items": ["Vue 3", "TypeScript", "…"] },
      { "id": "familiar",  "title": "熟悉 · 可以直接上手",   "variant": "secondary", "items": ["React 18", "…"] },
      { "id": "tools",     "title": "协作 · 工具链",         "variant": "outline",   "items": ["Git", "…"] }
    ],
    "nowDoing": [
      "🪴 **产品**：把「AI 辅助开发工作流」做成一个可复现的模板项目。",
      "📝 **写作**：保持 2~3 篇 / 月的节奏。",
      "🔍 **寻找**：有趣的独立项目 / 长期开源协作。",
      "🛠️ **技能打磨**：正在啃 Three.js + WebGPU 教程。"
    ]
  }
}
```

> 字段名使用 **camelCase（返回给前端）**；Prisma User 表里存 snake_case。Service 层要做一次 DB 列 → camelCase 的 DTO 映射。

---

#### 接口 B：admin 保存 About

**PUT /api/about** — 仅 admin（JWT 鉴权）

请求体（application/json）：
```json
{
  "shortBio": "string [必填] ≤300",
  "longBio": ["..."],
  "highlightStats": [{ "label": "...", "value": "..." }],
  "location": "string [必填] ≤100",
  "available": true,
  "tags": ["...", "...", "...", "..."],
  "interests": ["..."],
  "skillGroups": [
    { "id": "proficient", "title": "...", "variant": "default|secondary|outline", "items": ["Vue 3"] }
  ],
  "nowDoing": ["**粗体**也可以"]
}
```

> **注意**：`name`（=nickname）和 `avatar` 不在本接口改——这两个走已有的 User 模块 `POST /users/me` + `POST /users/avatar`。Tab1「账号资料」Tab2「关于我展示」各管自己的接口。

成功响应（200）：返回 **完整最新 About 对象**（跟 GET /api/about 的 data 结构完全相同），前端可以直接 setState，避免再发一次 GET。

**DTO 校验规则（class-validator）**：

| 字段 | 规则 |
|------|------|
| `shortBio` | `@IsString()` `@MaxLength(300)` `@IsNotEmpty()` |
| `longBio` | `@IsArray()` `@ArrayMaxSize(20)` 每项 `@IsString()` `@MaxLength(2000)` |
| `highlightStats` | `@IsArray()` `@ArrayMaxSize(8)` 每项 `{label: MaxLen(30), value: MaxLen(20)}` |
| `location` | `@IsString()` `@MaxLength(100)` `@IsNotEmpty()` |
| `available` | `@IsBoolean()` |
| `tags` | `@IsArray()` `@ArrayMinSize(1)` `@ArrayMaxSize(4)` 每项 `@IsString()` `@MaxLength(40)` |
| `interests` | `@IsArray()` `@ArrayMaxSize(20)` 每项 `@MaxLength(30)` |
| `skillGroups` | `@IsArray()` `@ArrayMaxSize(6)` 子项校验：id/title/variant(items: default/secondary/outline)/items[] |
| `nowDoing` | `@IsArray()` `@ArrayMaxSize(10)` 每项 `@MaxLength(500)` |

---

#### 错误枚举（遵守 `nestjs_standards.md` 的异常契约）

新增 `AboutBizError` 枚举（放 `server/src/modules/about/enums/about-biz-error.enum.ts`）：

| 枚举值 | 含义 | HTTP 语义 |
|--------|------|-----------|
| `ABOUT_DATA_MISSING = 5001` | DB 里没有任何 user 行（种子未初始化） | 500 |
| `ABOUT_SAVE_FAILED = 5002` | 保存失败（Prisma 错误） | 500 |

> 字段级校验失败由全局 ValidationPipe + class-validator 自动返回 400 BizError.VALIDATION_FAILED，
> 无需 About 模块自己处理。

---

### 3.6 数据库 / Prisma Schema 扩列设计

**User model 新增字段**（Prisma `schema.prisma` 声明）：

```prisma
model User {
  // ===== 已有列 =====
  id           Int       @id @default(autoincrement())
  username     String    @unique @db.VarChar(50)
  password     String    @db.VarChar(100)
  nickname     String    @db.VarChar(50)            // ← About.name 直接复用
  email        String?   @db.VarChar(100)
  avatar       String?   @db.VarChar(255)           // ← About 头像直接复用
  role         String    @default("admin") @db.VarChar(20)
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  // ===== ★ 新增 About 展示列 =====
  aboutShortBio     String   @default("") @db.VarChar(300)  @map("about_short_bio")
  aboutLongBio      Json     @default("[]")                 @map("about_long_bio")
  aboutSkills       Json     @default("[]")                 @map("about_skills")
  aboutHighlightStats Json  @default("[]")                 @map("about_highlight_stats")
  aboutInterests    Json     @default("[]")                 @map("about_interests")
  aboutTags         Json     @default("[]")                 @map("about_tags")
  aboutLocation     String   @default("") @db.VarChar(100)  @map("about_location")
  aboutAvailable    Boolean  @default(true)                 @map("about_available")
  aboutNowDoing     Json     @default("[]")                 @map("about_now_doing")

  @@map("user")
}
```

**种子数据（Prisma seed）**：初始化 admin 行时把前端 `data/about.ts` 的写死内容写入上述列，
保证旧页面无缝过渡（即使后端刚上线、admin 还没手动改）。

### 3.7 前端改造方案

#### 3.7.1 新增状态层（Pinia store）：`useAboutStore`

```
stores/about.ts
  └─ state:   about: AboutRsp | null
              loading: boolean
  └─ getters: displayName（兜底 authStore.user?.nickname ?? 'Trae'）
              displayAvatar（兜底 avatar → 首字母圆形图）
  └─ actions:
       fetchAbout() : Promise<AboutRsp>
         · 如果已有 about 直接返回（内存缓存）
         · 否则 request('/about') → 存 state → 返回
       saveAbout(params) : PUT /api/about → 更新本地 state
       invalidateCache() : about = null （强制下次重新拉）
```

#### 3.7.2 改造 3 个消费端 → 用 aboutStore

| 组件 | 改动要点 |
|------|---------|
| **AboutPage.vue** | 删除 `import { aboutMe, skillGroups } from '@/data'`；改为 `onMounted → aboutStore.fetchAbout()`。所有绑定路径：`aboutMe.xxx` → `aboutStore.about?.xxx`；`skillGroups` → `aboutStore.about?.skillGroups ?? []`。加载态加骨架屏。 |
| **HomePage.vue** | 同上。注意：`stats` 从 `aboutMe.highlightStats` 改为 `aboutStore.about?.highlightStats ?? []`；tags 同理。 |
| **DraggableStatsWidget.vue** | 同上。name/available/location 3 个点改绑定。 |

#### 3.7.3 兜底策略（数据缺失不白屏）

如果 DB 里 About 数据未初始化或接口报错 → store 自动 fallback 到 `@/data/about.ts` 的旧 mock 数据，
保证页面不会白屏或出现 undefined。生产环境可以去掉 fallback，保证数据唯一来源是 DB。

### 3.8 管理编辑器（Profile 页 Tab 化设计）

`/profile` 现有「账号资料」卡片 + 头像 → 加顶部 2 个 Tab 切换：

```
 ┌─────────────────────────────────────┐
 │  [ Tab1 · 账号资料 ]   [ Tab2 · 关于我展示 ]  ← 新增
 ├─────────────────────────────────────┤
 │                                     │
 │  （Tab1 现有内容：昵称/邮箱/头像）    │
 │          OR                         │
 │  （Tab2 新增编辑器）                 │
 │    · 短简介 Input (textarea 3 行)    │
 │    · 位置 Input                      │
 │    · 可接单状态 Switch               │
 │    · 标签 tags 4 颗 Input Chips      │
 │    · 长文段落 List Editor（段落数±）  │
 │    · highlightStats 4 组 Key-Value   │
 │    · 兴趣标签 Chips 编辑器            │
 │    · 技能分组 3 组 Editors（组名+variant+items） │
 │    · nowDoing 条目编辑器（支持 **加粗** 语法提示） │
 │                                     │
 │                     [ 取消 ]  [ 保存 ]
 └─────────────────────────────────────┘
```

编辑器每个子区域实现规范：
- 用 `shadcn-vue` `Tabs` 组件 + `TabList` + `TabContent`
- 数组类（longBio / skills / stats / interests / tags / nowDoing）用：`增 (+)` / `删 (-)` / `排序拖拽 (::)` ListEditor 模式
- skillGroups：用折叠 `<details>` 或子 Card，每一组内可以编辑：组标题（Input）+ 变体（Radio: default/secondary/outline）+ 技能项 Chips
- 保存：`PUT /api/about` → 返回完整对象 → 刷新 aboutStore → 顶部 Toast「保存成功」
- 取消：整 Tab 所有字段重置为 aboutStore.about 原值（不写入 store）

### 3.9 接口路由注册 / 模块位置

```
server/src/modules/about/
  ├── about.module.ts          # AboutModule：imports [PrismaModule]，controllers + providers
  ├── about.controller.ts      # @Controller('about')：GET + PUT
  ├── about.service.ts         # AboutService：getPublicAbout() + saveAbout(userId, body)
  ├── dto/
  │   ├── update-about.dto.ts  # UpdateAboutDto（class-validator 校验规则见 3.5）
  │   └── about.dto.ts         # AboutRsp 接口（GET 返回的 camelCase DTO）
  └── enums/
      └── about-biz-error.enum.ts  # AboutBizError + getAboutErrorInfo()
```

### 3.10 Redis Key & 缓存（可选）

为避免游客每访问一次 About 页就打一次 DB，可在 AboutService 里加一层 **1 分钟 Redis 缓存**：

| Key（遵守规范：项目:模块:用途） | TTL | 存值 |
|---|---|---|
| `personal_site:about:public` | 60 秒（1 min） | AboutRsp JSON 字符串 |

- **读**：先查 Redis → 命中 → 直接返回；否则查 DB → 写 Redis → 返回。
- **写**：PUT /api/about 成功后 → `del personal_site:about:public` → 下次 GET 自动重建缓存。
- **降级**：Redis 挂了 → 走 DB（try/finally 包一层），不影响业务。

---

> **下一个模块：Post 文章** — 请回复「继续」以开始分析。

---

## 模块四：Post 文章 + Category 分类 + Tag 标签

> **目标**：个人博客核心实体。采用**严格关系模型**（Post / Category / Tag / PostTag 四张表），
> 正文 Markdown 存 MySQL `TEXT`，前端浏览器端 `marked + DOMPurify` 渲染。
> 遵循 [NestJS-Architecture-Guide.md](./NestJS-Architecture-Guide.md) 分层架构：Controller → Service → Prisma（不抽 Repository）。

### 4.1 需求概述

| 角色 | 权限 | 说明 |
|------|------|------|
| 博主 (admin) | 全部 CRUD | 登录后创建/编辑/删除文章；管理分类、标签 |
| 游客 (guest) | 只读已发布 | 无需登录，浏览 `status=published` 文章列表与详情；草稿/归档不可见 |

### 4.2 数据模型设计（Prisma Schema）

**逻辑外键策略**：`datasource.relationMode = "prisma"` — MySQL 不生成 `FOREIGN KEY` 约束，
Prisma `@relation` / `include` / `onDelete` 照常工作（referential integrity 由 Prisma 模拟）。

```prisma
/// 文章发布状态（软删除：ARCHIVED 不公开，但保留热力图贡献计数）
enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

/// 文章分类（严格关系模型：Post.category_id 外键关联）
model Category {
  id        Int      @id @default(autoincrement())
  name      String   @unique @db.VarChar(50)
  sort      Int      @default(0) @db.Int
  authorId  Int      @map("author_id")
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  posts     Post[]
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([authorId])
  @@map("category")
}

/// 文章标签（严格关系模型：Tag 全局唯一，renameTag 只需 UPDATE 一行）
model Tag {
  id        Int      @id @default(autoincrement())
  name      String   @unique @db.VarChar(50)
  posts     PostTag[]
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("tag")
}

/// 文章表（主体）· 正文存 MySQL TEXT
model Post {
  id          Int       @id @default(autoincrement())
  slug        String    @unique @db.VarChar(200)
  title       String    @db.VarChar(300)
  excerpt     String    @default("") @db.VarChar(500)
  content     String    @db.Text
  cover       String?   @db.VarChar(500)
  featured    Boolean   @default(false)
  status      PostStatus @default(DRAFT)
  wordCount   Int       @default(0) @map("word_count")
  readMinutes Int       @default(1) @map("read_minutes")

  authorId   Int        @map("author_id")
  author     User       @relation(fields: [authorId], references: [id], onDelete: Cascade)

  categoryId Int?       @map("category_id")
  category   Category?  @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  tags       PostTag[]

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([slug])
  @@index([status])
  @@index([createdAt])
  @@index([categoryId])
  @@index([authorId])
  @@map("post")
}

/// Post ↔ Tag 多对多中间表（显式定义，方便后续加 tagOrder 这类字段）
model PostTag {
  postId    Int
  tagId     Int
  post      Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag       Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([postId, tagId])
  @@map("post_tag")
}
```

#### 表关系图

```
  ┌──────────┐         ┌──────────┐
  │   User   │1───────*│ Category │1──────*│
  └──────────┘  author └──────────┘ category └──┐
        │                                        │
        │ author                           ┌─────┴─────┐
        │                                  │    Post    │
        │                                  │ (主体表)   │
        │                                  └─────┬──────┘
        │                              category │
        │           ┌──────────────────────────┘
        │           │            tags (M:N)
        │           │                │
        │     ┌─────┴─────┐   ┌─────┴─────┐
        └────│  PostTag  │*──*│    Tag    │
             │ (中间表)  │   │ (全局唯一) │
             └───────────┘   └───────────┘
```

| 关系 | 类型 | onDelete 策略 | 说明 |
|------|------|---------------|------|
| User → Post | 1:N | Cascade | 删博主 → 文章全删 |
| User → Category | 1:N | Cascade | 删博主 → 分类全删 |
| Category → Post | 1:N | **SetNull** | 删分类 → 文章 category_id 置空（不连坐删文章） |
| Post ↔ Tag | M:N | Cascade | 删 Post → 中间表行删；删 Tag → 中间表行删 |

#### 逻辑外键验证（已完成）

| 验证项 | 结果 |
|--------|------|
| MySQL 表 | `category, post, post_tag, tag, user`（5 张全齐）✅ |
| 物理 FK 约束 | `[]`（空 — `relationMode=prisma` 生效）✅ |
| 二级索引 | `post_author_id_idx` / `post_category_id_idx` / `post_created_at_idx` / `post_status_idx` / `post_slug_idx+key` / `category_author_id_idx` / `category_name_key` / `tag_name_key` ✅ |

### 4.3 接口设计

路由前缀 `@Controller('api/posts')`，与其他模块（`/api/about`、`/api/users`、`/api/contribution`）风格统一。

| 方法 | 路由 | 权限 | 说明 |
|------|------|------|------|
| `GET` | `/api/posts` | 公开（游客） / 可选 JWT（博主看草稿） | 分页 + 过滤（keyword/categoryId/status/featured/tagIds） |
| `GET` | `/api/posts/:id` | 公开 | 文章详情（含 Markdown content） |
| `GET` | `/api/posts/slug/:slug` | 公开 | 按 URL 别名查详情 |
| `POST` | `/api/posts` | 需登录（JwtAuthGuard） | 新建文章 |
| `PUT` | `/api/posts/:id` | 需登录 | 更新文章（全量 replace tagIds） |
| `DELETE` | `/api/posts/:id` | 需登录 | 软删除（status → ARCHIVED）或硬删除 |

> **DELETE 策略**：默认软删除（`status = ARCHIVED`），保留热力图贡献计数；
> 若传 `?hard=true` 查询参数则物理删除（仅博主）。

### 4.4 DTO 字段规范

#### CreatePostDto

| 字段 | 类型 | 校验 | 说明 |
|------|------|------|------|
| `slug` | string | `@Length(1,200)` `@IsNotEmpty` | URL 别名，全局唯一 |
| `title` | string | `@Length(1,300)` `@IsNotEmpty` | 标题 |
| `excerpt` | string? | `@Length(0,500)` | 摘要，默认空字符串 |
| `content` | string | `@IsNotEmpty` | Markdown 正文（存 TEXT） |
| `cover` | string? | `@Length(0,500)` | 封面图 URL |
| `featured` | boolean? | `@IsBoolean` | 是否精选 |
| `status` | PostStatusDto? | `@IsIn(['draft','published','archived'])` | 状态，默认 DRAFT |
| `categoryId` | number? | `@IsInt` | 分类 ID（外键） |
| `tagIds` | number[]? | `@IsArray` `@IsInt({each:true})` | 标签 ID 数组 |

> **wordCount / readMinutes 不在 DTO 中暴露** — Service 层 `calcMetrics(content)` 计算，防止客户端伪造。

#### UpdatePostDto

所有字段可选（PartialType 语义）。`tagIds` 为全量数组（replace 策略：Service 先 deleteMany 旧关联再 create 新关联）。

#### QueryPostDto

| 字段 | 类型 | 校验 | 说明 |
|------|------|------|------|
| `page` | number? | `@Min(1)` | 页码，默认 1 |
| `pageSize` | number? | `@Min(1)` `@Max(100)` | 每页条数，默认 10，上限 100 |
| `keyword` | string? | - | 模糊搜索 title OR excerpt |
| `categoryId` | number? | `@IsInt` | 精确匹配分类 |
| `status` | PostStatusDto? | `@IsIn` | 状态过滤（游客默认 published） |
| `featured` | boolean? | `@IsBoolean` | 仅精选 |
| `tagIds` | number[]? | `@IsInt({each:true})` | 命中任一标签 |

#### PostVo（视图对象）

```typescript
interface PostVo {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content?: string;          // 列表接口 undefined，详情接口返回 Markdown 原文
  cover: string | null;
  featured: boolean;
  status: PostStatusDto;     // 'draft' | 'published' | 'archived'
  wordCount: number;
  readMinutes: number;
  category: { id, name, sort } | null;   // CategoryRefVo
  tags: { id, name }[];                  // TagRefVo[]
  author: { id, nickname, avatar };       // AuthorRefVo
  createdAt: string;
  updatedAt: string;
}
```

### 4.5 PostStatus 状态机

```
         create (default)
              │
              ▼
        ┌─────────┐  publish   ┌───────────┐
        │  DRAFT  │───────────▶│ PUBLISHED │
        │ (草稿)  │◀───────────│ (已发布)   │
        └─────────┘  unpublish └───────────┘
              │                       │
              │         archive       │
              └──────────┬────────────┘
                         ▼
                   ┌──────────┐
                   │ ARCHIVED │  软删除：列表不展示，热力图保留计数
                   └──────────┘
```

| 状态 | 列表可见 | 详情可见 | 热力图计数 | 说明 |
|------|---------|---------|-----------|------|
| `DRAFT` | 仅博主 | 仅博主 | ✅ | 草稿，未发布 |
| `PUBLISHED` | 所有人 | 所有人 | ✅ | 已发布，公开可见 |
| `ARCHIVED` | 仅博主 | 仅博主 | ✅ | 归档（软删除），不公开但不丢贡献记录 |

### 4.6 Markdown 存储与渲染

```
存储方向                                    渲染方向
─────────────                           ─────────────

用户写 Markdown                         浏览器 GET /api/posts/:slug
       │                                         │
       ▼                                         ▼
BlogEditorPage                          后端 PostService.findById()
(前端 textarea)                                 │
       │                                         │ 返回 JSON
       ▼                                         ▼
POST /api/posts                        { content: "### 标题\n正文..." }
Body: { content: "###..." }
       │                                         │
       ▼                                         ▼
Prisma post.content                    前端 BlogDetailPage
→ MySQL TEXT                            │
  存的就是纯字符串                       ▼
  包含真实 \n 换行                     marked.parse(content)
  不存 HTML                             → DOMPurify.sanitize(html)
       │                                → v-html 安全渲染
       ▼
  磁盘实际值:
  "### 标题\n\n- list 1\n正文 **bold**"
```

| 问题 | 答案 |
|------|------|
| 数据库存什么类型？ | MySQL `TEXT` — 本质是字符串，最大 64KB，包含真实 `\n` 换行符 |
| 后端查出来也是字符串吗？ | 是。`prisma.post.findUnique()` → `post.content` 类型为 `string`，原样返回 |
| 谁解析成 Markdown？ | **100% 前端浏览器端解析**。后端永不渲染 HTML |
| 用什么库？ | `marked`（Markdown→HTML）+ `DOMPurify`（XSS 清洗）两段式 |
| 正文 key-value 分离？ | 不实施。个人博客量级（几 MB）用 MySQL TEXT 足够。优化走 Redis 缓存详情接口 |

### 4.7 业务规则

| 规则 | 实现方式 |
|------|----------|
| **wordCount / readMinutes** | DTO 不暴露字段 → Service `calcMetrics(content)` 计算：`wordCount = content.length`，`readMinutes = max(1, ceil(wordCount/500))` |
| **slug 全局唯一** | schema `@unique` + Service 层 catch Prisma `P2002` → 抛 `PostBizError.SLUG_CONFLICT` |
| **tagIds 关联** | Create/Update 时，先校验所有 tagId 存在（`prisma.tag.findMany({ where: { id: { in: tagIds } } })`），不存在抛 `TAG_NOT_FOUND`；Update 用 replace 策略（deleteMany 旧 + create 新） |
| **categoryId 校验** | 传值时校验分类存在 → 不存在抛 `CATEGORY_NOT_FOUND`；删分类时 schema `onDelete: SetNull` 自动置空 |
| **公开接口 status 过滤** | 游客（无 JWT）→ Service 硬塞 `status: 'published'`；博主（有 JWT）→ 按 DTO 传的 status 过滤 |
| **列表不含 content** | 查询列表时 `select` 不含 content 字段，减少传输体积；详情接口才返回 content |

### 4.8 权限守卫设计

遵循 [NestJS-Architecture-Guide.md §3.2 ⑥](./NestJS-Architecture-Guide.md) Guard 设计：

```typescript
// 1. JwtAuthGuard — 强制登录（博主专属接口）
//    @UseGuards(JwtAuthGuard) 标注 POST / PUT / DELETE
//    → JwtStrategy.validate() 解析 payload → 注入 req.user

// 2. OptionalJwtAuthGuard — 游客可访问，博主可看草稿
//    @UseGuards(OptionalJwtAuthGuard) 标注 GET 列表
//    → Guard 不拦截无 Token 请求，Controller 内判断 req.user?.role
//    → 游客只看 published，博主看全部
```

### 4.9 Redis Key & 缓存（已实现）

| Key（遵守规范：项目:模块:用途） | TTL | 存值 | 失效时机 |
|---|---|---|---|
| `personal_site:cache:post:detail:id:{id}` | 1 小时 + 随机 10% | 文章详情 JSON | POST/PUT/DELETE 后 del |
| `personal_site:cache:post:detail:slug:{slug}` | 1 小时 + 随机 10% | 文章详情 JSON | POST/PUT/DELETE 后 del |
| `personal_site:cache:post:detail:*` (NULL_FLAG) | 60 秒 + 随机 10% | `{"__null__":true}` | 新文章创建后 del |

**缓存只对游客（publicOnly=true）生效，博主请求直接走 DB。**

#### 三大缓存问题防范

| 问题 | 防范策略 | 实现 |
|------|---------|------|
| **穿透** | 空值缓存 | 查不到的文章缓存 `NULL_FLAG`（TTL=60s），下次同 key 直接命中不查 DB |
| **击穿** | singleflight Promise 复用 | 内存 `Map<string, Promise<PostVo>>`，同 key 并发请求只查一次 DB |
| **雪崩** | TTL 随机化 | `randomTtl(base) = base + Math.random() * base * 0.1`，错峰过期 |
| **降级** | try/catch 走 DB | Redis 读/写全 try/catch，挂了走 DB 不影响业务 |

#### 缓存读写流程

```
游客请求 GET /api/posts/:id
       │
       ▼
findCached(cacheKey, dbQuery, publicOnly=true)
       │
  ┌────┴────┐
  │ 读 Redis │
  └────┬────┘
       │
  ┌────┴────────────────────────────────────────┐
  │ 命中 NULL_FLAG → 抛 NOT_FOUND（防穿透）       │
  │ 命中正常值   → JSON.parse 返回 PostVo         │
  │ 未命中       → 继续                           │
  └─────────────────────────────────────────────┘
       │ 未命中
       ▼
  ┌──────────────┐
  │ singleflight │  ┌─ 已有 inflight Promise → await 复用（防击穿）
  │ Map 查找     │  └─ 无 inflight → 新建 Promise → 查 DB
  └──────────────┘
       │
       ▼
  ┌─────────────────────────────────┐
  │ DB 查到 → 写 Redis（TTL 随机化）  │ → 返回 PostVo
  │ DB 查不到 → 写 NULL_FLAG（60s）  │ → 抛 NOT_FOUND
  └─────────────────────────────────┘
       │
       ▼
  finally: inflight.delete(cacheKey)
```

### 4.10 PostBizError 错误码

遵循项目异常体系（`IErrorInfo` 接口契约 + 模块级枚举），码段 `2000~2099`：

| 枚举 | 码 | message | 触发场景 |
|------|----|---------|---------|
| `NOT_FOUND` | 2001 | 文章不存在 | findById/findBySlug 查空 |
| `CATEGORY_NOT_FOUND` | 2002 | 分类不存在 | categoryId 校验失败 |
| `TAG_NOT_FOUND` | 2003 | 标签不存在 | tagIds 校验失败 |
| `SLUG_CONFLICT` | 2004 | 文章 URL 别名已存在 | slug unique 冲突 |
| `NOT_AUTHOR` | 2005 | 无权限操作该文章 | 非 admin 试图 CUD |
| `CATEGORY_HAS_POSTS` | 2006 | 该分类下还有文章，无法删除 | 删分类前检查 |
| `TAG_HAS_POSTS` | 2007 | 该标签下还有文章，无法删除 | 删标签前检查 |

### 4.11 开发进度

| 阶段 | 任务 | 状态 |
|------|------|------|
| Phase 1-1 | Prisma schema — Post/Category/Tag/PostTag 四张表 + User 外键 | ✅ 完成 |
| Phase 1-2 | `relationMode=prisma` 逻辑外键 + `db push` 同步数据库 + 验证 | ✅ 完成 |
| Phase 2-1 | Post DTO 重写 — PostStatus 映射 / slug / excerpt / cover / featured / categoryId / tagIds / calcMetrics | ✅ 完成 |
| Phase 2-2 | PostService 重写 — Prisma 分页 CRUD + include category/tags/author + publicOnly | ✅ 完成 |
| Phase 3-1 | PostController `@Controller('api/posts')` + OptionalJwtAuthGuard + JwtAuthGuard + authorId 注入 | ✅ 完成 |
| Phase 3-2 | PostService Redis 缓存 — 防穿透(空值缓存)/击穿(singleflight)/雪崩(TTL随机化)/降级 | ✅ 完成 |
| Phase 3-3 | ContributionService `tableExists('post')` 接通，热力图统计真实数据 | 📝 待开发 |
| Phase 4 | Category + Tag 模块（CRUD + rename/merge/delete） | 📝 待开发 |
| Phase 5 | `seed-posts.mjs` 导入 8 篇内置 mock + `verify-post.mjs` 端到端 | 📝 待开发 |

> **架构遵循**：本模块严格遵循 [NestJS-Architecture-Guide.md](./NestJS-Architecture-Guide.md) 的分层架构（Controller → Service → Prisma，不抽 Repository）、模块化设计（`@Module` 注册 controllers + providers）、依赖注入（`PrismaService` 全局注入）、统一异常处理（`BusinessException` + 全局过滤器）、统一响应封装（`Result<T>`）。
