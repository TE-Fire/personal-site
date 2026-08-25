# Personal Site Server · 后端骨架

> **NestJS 10 + TypeScript + Prisma + MySQL + Redis + JWT**
> 配套前端：`../`（Vue 3 + Vite + Tailwind CSS）

---

## 📁 目录结构

```
server/
├── prisma/                    # Prisma schema + 迁移（等接入数据库后填入）
├── src/
│   ├── common/                # 全局基础设施
│   │   ├── common.module.ts           # @Global() 模块
│   │   ├── prisma.service.ts          # PrismaClient 单例
│   │   ├── result.ts                  # Result<T> 统一响应封装
│   │   ├── exception.ts               # BusinessException + BizCode
│   │   ├── global-exception.filter.ts # 全局异常过滤器
│   │   └── validation.pipe.ts         # class-validator 校验管道
│   │
│   ├── modules/               # 业务模块（每个 feature 一个文件夹）
│   │   ├── auth/              # 认证模块（登录/注册/JWT/守卫/策略）
│   │   │   ├── dto/
│   │   │   ├── guards/jwt-auth.guard.ts
│   │   │   ├── strategies/jwt.strategy.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.module.ts
│   │   ├── user/              # 用户模块（CRUD 骨架）
│   │   └── post/              # 文章模块（CRUD 骨架）
│   │
│   ├── app.controller.ts      # 健康检查 /health
│   ├── app.module.ts          # 根模块：装配 ConfigModule + 所有业务模块
│   └── main.ts                # 入口：CORS/Helmet/全局管道/Swagger
│
├── .env.example               # 环境变量模板（不包含敏感信息）
├── .env                       # 本地开发环境变量（.gitignore 不提交）
├── .gitignore
├── eslint.config.mjs          # ESLint flat config（NestJS 专用规则）
├── prettier.config.js         # Prettier 配置
├── tsconfig.json              # TS 配置（含 path alias: @/* → src/*）
├── tsconfig.build.json
├── nest-cli.json
└── package.json
```

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 配置环境变量

直接使用已生成的 `.env`，或复制模板：

```bash
cp .env.example .env
```

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `3000` |
| `API_PREFIX` | API 前缀 | `api` |
| `DATABASE_URL` | MySQL 连接串 | `mysql://root:123456@127.0.0.1:3306/personal_site` |
| `JWT_SECRET` | JWT 签名密钥（上线务必修改！） | `please-change-me-in-production` |
| `JWT_EXPIRES_IN` | Token 有效期 | `7d` |
| `CORS_ORIGIN` | 允许的前端域名（逗号分隔多域名） | `http://127.0.0.1:5175` |

### 3. 启动开发服务器

```bash
# 开发模式（watch & reload）
npm run start:dev

# 或直接启动
npm run start
```

启动成功后：

| 地址 | 说明 |
|------|------|
| `http://localhost:3000/health` | 健康检查 |
| `http://localhost:3000/api/docs` | Swagger 接口文档 |
| `http://localhost:3000/api/auth/login` | 登录接口（mock: admin/admin） |
| `http://localhost:3000/api/posts` | 文章列表（公开） |

### 4. 代码检查与格式化

```bash
# ESLint 检查并自动修复
npm run lint

# Prettier 格式化
npm run format
```

### 5. 构建生产包

```bash
npm run build
# → 产物在 dist/，然后运行：
npm run start:prod
```

### 6. 数据库接入（Todo，阶段二再做）

```bash
# 1. 在 prisma/schema.prisma 写好表结构
# 2. 生成迁移 & 应用
npm run prisma:migrate -- --name init

# 3. 生成 Prisma Client（@prisma/client 类型）
npm run prisma:generate

# 4. 可视化数据库
npm run prisma:studio
```

---

## 🧩 模块说明

### Result<T> 统一响应

所有接口返回统一结构：

```json
{ "code": 200, "data": {...}, "message": "success" }
```

- Controller 中使用：`return Result.ok(data, '操作成功')`
- 异常统一抛 `BusinessException('xxx', BizCode.XXX)`，由全局过滤器封装为失败响应

### 模块规范（后续新增 feature 时遵循）

```
modules/{feature}/
├── dto/                  # 入参（Create/Update/Query + Vo 出参）
├── {feature}.module.ts   # 声明模块
├── {feature}.service.ts  # 业务逻辑（注入 PrismaService）
└── {feature}.controller  # 路由（注入 Service）
```

- Controller 尽量薄：仅路由声明 + 参数注入 + 调用 Service + 返回 Result
- 所有业务逻辑放 Service，复杂业务提取 Service 方法
- 数据库操作只在 Service 中通过 `PrismaService` 访问

### 安全守卫

```typescript
// 给需要登录的 Controller 或方法加上：
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
```

前端请求头携带：`Authorization: Bearer <accessToken>`

---

## 📜 约定式开发规范

### 命名
- 变量 / 函数：`camelCase`
- 类 / 接口 / DTO 类：`PascalCase`
- 数据库列名 / 文件路径：`snake_case` / `kebab-case`
- 模块名用复数：`UsersModule`, `PostsModule`

### 代码质量
- `npm run lint`：NestJS 专用 ESLint 规则（含 import 排序、装饰器顺序）
- `npm run format`：Prettier 统一风格（4 空格，120 printWidth）

---

## 📅 开发路线图

- ✅ **阶段一（基建）**：骨架 + 配置 + 模块分层 + 登录 mock
- ⬜ **阶段二（数据库）**：Prisma schema、迁移、User/Post/Tag/Category 真实 CRUD
- ⬜ **阶段三（高级查询）**：标签共现关系 / 搜索 / 缓存
- ⬜ **阶段四（部署）**：Docker + PM2 + 前后端打包联调
