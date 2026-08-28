# 个人站点 · 项目开发规格说明

> 本文档以前端现有代码为原型，逐模块反推后端数据表与接口设计。
> 每个模块独立分析，按开发优先级逐步补充。

---

## 模块开发顺序

| 序号 | 模块 | 状态 | 说明 |
|------|------|------|------|
| 1 | Auth 认证 | ✅ 已分析 | 博主登录 / 游客只读，不开放注册 |
| 2 | Post 文章 | ⬜ 待分析 | 核心实体，关联 Category + Tag |
| 3 | Category 分类 | ⬜ 待分析 | |
| 4 | Tag 标签 | ⬜ 待分析 | 含共现关系 / 3D 星链数据 |
| 5 | Life 生活碎片 | ⬜ 待分析 | 照片 / 音乐 / 随笔 |

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

> **下一个模块：Post 文章** — 请回复「继续」以开始分析。
