# 后端框架集成指南 · Prisma + Redis + JWT

> 本文档面向本项目（NestJS + TypeScript）后端开发者，讲解项目中已集成使用的三大基础组件：**Prisma ORM、Redis 缓存、JWT 鉴权** 的基本使用方法、约定与常见模式。
>
> - 适用读者：刚加入项目的开发者 / 想快速回顾用法的自己
> - 阅读前提：已了解 NestJS 模块化、依赖注入（DI）基本概念
> - 文档版本：2026-08-28（auth 模块完成登录 + 改密 + 跑通全链路）

---

## 目录

1. [整体架构与依赖关系](#1-整体架构与依赖关系)
2. [Prisma ORM — MySQL 数据库访问](#2-prisma-orm--mysql-数据库访问)
3. [Redis — 缓存与会话存储](#3-redis--缓存与会话存储)
4. [JWT — Token 鉴权](#4-jwt--token-鉴权)
5. [三者协同：完整登录流程](#5-三者协同完整登录流程)
6. [常见问题 FAQ](#6-常见问题-faq)

---

## 1. 整体架构与依赖关系

```
                  ┌─────────────────────────────────────────┐
                  │              AppModule（根）              │
                  │  imports: ConfigModule, CommonModule,    │
                  │           RedisModule, AuthModule, ...   │
                  └────────────────┬────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
   CommonModule (@Global)     RedisModule (@Global)      AuthModule
   ├─ PrismaService           ├─ RedisService            ├─ AuthService
   │  (extends PrismaClient)  │  (wraps ioredis)         │  (注入 Prisma + Redis + Jwt)
   │                          │                          ├─ JwtStrategy
   │                          │                          └─ JwtAuthGuard
   │                          │
   │                          ▼
   │                  验证码 / 缓存 / Token 黑名单
   ▼
   user 表（MySQL）
```

**关键约定**：
- `CommonModule` 和 `RedisModule` 都用了 `@Global()` 装饰器，所以业务模块（如 `AuthModule`）**无需在 imports 里再写一遍**，直接在 Service 构造函数注入即可使用。
- `PrismaService` 继承自 `PrismaClient`，所有 Prisma 的查询方法（`findUnique` / `findMany` / `create` / `update` / `delete` 等）都直接挂在 `this.prisma` 上。

---

## 2. Prisma ORM — MySQL 数据库访问

### 2.1 三件套：`schema.prisma` / `PrismaClient` / `PrismaService`

| 文件 | 作用 | 路径 |
|---|---|---|
| `schema.prisma` | 数据模型定义（DDL） | [server/prisma/schema.prisma](file:///d:/personal-site/server/prisma/schema.prisma) |
| `init.sql` | 手写的初始数据脚本（建库 + 建表 + 插入 admin） | [server/prisma/init.sql](file:///d:/personal-site/server/prisma/init.sql) |
| `PrismaService` | NestJS 注入用的 PrismaClient 包装 | [server/src/common/prisma.service.ts](file:///d:/personal-site/server/src/common/prisma.service.ts) |

### 2.2 schema.prisma 文件结构

```prisma
generator client {
  provider = "prisma-client-js"   // 生成 Prisma Client 代码
}

datasource db {
  provider = "mysql"               // 数据库类型
  url      = env("DATABASE_URL")   // 从 .env 读取连接字符串
}

model User {
  id        Int      @id @default(autoincrement())
  username  String   @unique @db.VarChar(50)
  password  String   @db.VarChar(100)
  nickname  String?  @db.VarChar(50)
  email     String?  @db.VarChar(100)
  avatar    String?  @db.VarChar(500)
  role      String   @default("admin") @db.VarChar(20)
  status    Int      @default(1) @db.TinyInt
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("user")   // 让 model User 映射到 MySQL 表名 user（全小写）
}
```

**字段映射约定（重要）**：
- Prisma model 名用 **PascalCase**（`User`），但 MySQL 表名用 **lowercase**（`user`）→ 用 `@@map("user")` 显式指定
- Prisma 字段名用 **camelCase**（`createdAt`），但 MySQL 列名用 **snake_case**（`created_at`）→ 用 `@map("created_at")` 显式指定
- `String?` 表示可空（对应 `DEFAULT NULL`），`String` 表示非空（对应 `NOT NULL`）
- `@db.VarChar(50)` 等显式指定底层列类型，确保 Prisma Client 类型与数据库实际类型一致

### 2.3 修改 schema 后的两个动作

```bash
# 1. 重新生成 Prisma Client（修改 schema 后必做）
cd server
npx prisma generate

# 2. 同步到数据库（开发期：手动改 SQL 文件 + source 执行，避免误改生产）
#    详见 server/prisma/init.sql
mysql -uroot -pwangxu8044 -e "source d:/personal-site/server/prisma/init.sql"
```

> ⚠️ 项目暂未启用 `prisma migrate`（自动迁移），改表结构需要手写 SQL。
> 这样能完整控制 SQL 细节（字段 COMMENT / 索引 / 字符集），代价是不能用 `prisma migrate dev`。

### 2.4 在 Service 中使用 Prisma

**注入方式**（[auth.service.ts](file:///d:/personal-site/server/src/modules/auth/auth.service.ts) 是范例）：

```typescript
import { PrismaService } from '@/common/prisma.service';

@Injectable()
export class AuthService {
  // 通过构造函数注入（CommonModule 是 @Global，所以 AuthModule 不用 imports）
  constructor(
    private readonly prisma: PrismaService,
    // ...其他依赖
  ) {}
}
```

**常用查询模式**：

```typescript
// 1. 单条查询（按主键或唯一键）
const user = await this.prisma.user.findUnique({
  where: { id: 1 },
});

// 2. 单条查询 + 字段筛选（不返回敏感字段如 password）
const user = await this.prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    username: true,
    nickname: true,
    // password 不写 = 不查询
  },
});

// 3. 条件查询（多条）
const users = await this.prisma.user.findMany({
  where: { status: 1 },
  orderBy: { createdAt: 'desc' },
  skip: 0,
  take: 10,
});

// 4. 创建
const newUser = await this.prisma.user.create({
  data: {
    username: 'newuser',
    password: hashedPassword,
    nickname: '新用户',
    role: 'admin',
  },
});

// 5. 更新
const updated = await this.prisma.user.update({
  where: { id: 1 },
  data: { nickname: '新昵称' },
});

// 6. 删除
await this.prisma.user.delete({ where: { id: 1 } });
```

**事务（多表操作需要原子性时）**：

```typescript
const [user, profile] = await this.prisma.$transaction([
  this.prisma.user.create({ data: { ... } }),
  this.prisma.profile.create({ data: { ... } }),
]);

// 或回调式（更灵活）
await this.prisma.$transaction(async (tx) => {
  const u = await tx.user.create({ data: { ... } });
  await tx.profile.create({ data: { userId: u.id, ... } });
});
```

### 2.5 Prisma 字段类型 vs TypeScript 类型

| Prisma 字段 | TS 类型 | 说明 |
|---|---|---|
| `Int` | `number` | 整数（4 字节） |
| `String` | `string` | 字符串 |
| `String?` | `string \| null` | 可空字符串 |
| `Boolean` | `boolean` | 布尔 |
| `DateTime` | `Date` | 日期对象 |
| `Json` | `Prisma.JsonValue` | JSON 字段 |

> **不要用 BigInt**：BigInt 在前端序列化为字符串会很麻烦。如果主键用 `Int`（4 字节，最大 42 亿）够用，避免 BigInt 类型污染前端 API。

---

## 3. Redis — 缓存与会话存储

### 3.1 RedisService 封装

文件：[server/src/modules/redis/redis.service.ts](file:///d:/personal-site/server/src/modules/redis/redis.service.ts)

底层用 [`ioredis`](https://github.com/redis/ioredis) 库，封装为 NestJS Service：

```typescript
@Injectable()
export class RedisService implements OnModuleInit {
  private client!: Redis;

  async onModuleInit() {
    this.client = new Redis({
      host: this.config.get('REDIS_HOST') || '127.0.0.1',
      port: Number(this.config.get('REDIS_PORT')) || 6379,
    });
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void>
  async get(key: string): Promise<string | null>
  async del(key: string): Promise<void>
  async exists(key: string): Promise<boolean>
}
```

### 3.2 基础用法

**注入方式**（[captcha.service.ts](file:///d:/personal-site/server/src/modules/captcha/captcha.service.ts) 是范例）：

```typescript
import { RedisService } from '../redis/redis.service';

@Injectable()
export class CaptchaService {
  constructor(private readonly redis: RedisService) {}
}
```

**基本操作**：

```typescript
// 1. 写入（带 TTL 5 分钟）
await this.redis.set('captcha:abc-123', '127', 300);

// 2. 读取
const value = await this.redis.get('captcha:abc-123');
// value === '127' （字符串！数字需要自己 Number() 转换）

// 3. 删除（一次性消费）
await this.redis.del('captcha:abc-123');

// 4. 判断是否存在
const exists = await this.redis.exists('user:session:xxx');
```

### 3.3 Key 命名约定

为了便于管理和检索，所有 Redis Key 用 **冒号分隔的命名空间**：

| Key 模式 | 用途 | TTL |
|---|---|---|
| `captcha:{uuid}` | 滑块验证码（存 targetX） | 5 分钟 |
| `auth:refresh:{jti}` | 后续 Refresh Token 黑名单 | 7 天 |
| `cache:post:list:{page}` | 后续文章列表缓存 | 10 分钟 |

### 3.4 降级策略（Redis 不可用时）

参考 [captcha.service.ts#L99-L108](file:///d:/personal-site/server/src/modules/captcha/captcha.service.ts#L99-L108)：

```typescript
try {
  await this.redis.set(redisKey, String(targetX), this.CAPTCHA_TTL);
} catch {
  this.logger.warn('Redis 不可用，降级到内存存储');
  this.memoryStore.set(captchaId, targetX);
  setTimeout(() => this.memoryStore.delete(captchaId), this.CAPTCHA_TTL * 1000);
}
```

**适用场景**：验证码这种「丢了能让用户重试」的业务可以降级。涉及一致性强的业务（如 Token 黑名单）**不要降级**，直接报错更安全。

---

## 4. JWT — Token 鉴权

### 4.1 三件套：`JwtModule` / `JwtService` / `JwtStrategy`

| 组件 | 文件 | 作用 |
|---|---|---|
| `JwtModule` | [auth.module.ts](file:///d:/personal-site/server/src/modules/auth/auth.module.ts) | 模块注册，注入 secret 和过期时间 |
| `JwtService` | `@nestjs/jwt` 内置 | 签发 / 解析 Token |
| `JwtStrategy` | [strategies/jwt.strategy.ts](file:///d:/personal-site/server/src/modules/auth/strategies/jwt.strategy.ts) | Passport 策略，验证 Token 并把 user 挂到 `req.user` |
| `JwtAuthGuard` | [guards/jwt-auth.guard.ts](file:///d:/personal-site/server/src/modules/auth/guards/jwt-auth.guard.ts) | 路由守卫，拦截未带 Token 的请求 |

### 4.2 模块注册

```typescript
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),           // 从 .env 读
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN') || '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  // ...
})
export class AuthModule {}
```

### 4.3 签发 Token（登录时）

```typescript
// auth.service.ts · login 方法
const payload = {
  sub: user.id,           // 用户 id（必填，JwtStrategy 会用它）
  username: user.username,
  role: user.role,
};

const accessToken = this.jwt.sign(payload, {
  expiresIn: 7 * 24 * 60 * 60,   // 7 天（秒）
  secret: this.config.get('JWT_SECRET'),
});

return { accessToken, expiresIn, tokenType: 'Bearer' };
```

### 4.4 验证 Token（受保护路由）

**a) 路由守卫方式**（推荐，最简洁）：

```typescript
@Get('profile')
@UseGuards(JwtAuthGuard)   // ← 自动验证 Token
async profile(@Req() req: Request) {
  // req.user 已经被 JwtStrategy 填充为 { id, role }
  const user = req.user as { id: number; role: string };
  return this.authService.profile(user.id);
}
```

**b) JwtStrategy 内部逻辑**：

```typescript
// strategies/jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService, private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),  // 从 Authorization: Bearer xxx 提取
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  // Token 验证通过后会自动调用，返回值会挂到 req.user
  async validate(payload: { sub: number; username: string; role: string }) {
    return this.authService.validateUser(payload.sub);
  }
}
```

### 4.5 前端如何携带 Token

前端在 axios 拦截器中统一注入：

```typescript
// src/lib/axios.ts
instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

后端 `ExtractJwt.fromAuthHeaderAsBearerToken()` 会自动从 `Authorization` Header 中提取。

### 4.6 修改密码接口（已实现）

**路由**：`POST /api/auth/change-password`（需登录，JwtAuthGuard 保护）

**流程**：
```
前端 ChangePasswordDialog 弹窗
  → oldPassword + newPassword
  → POST /auth/change-password (Bearer Token)

后端 AuthService.changePassword()
  1. PrismaService.user.findUnique({ where: { id: userId } })    ← 取 password 字段
  2. bcrypt.compare(dto.oldPassword, user.password)              ← 校验旧密码
  3. oldPassword === newPassword → 拒绝                         ← 新旧不能相同
  4. bcrypt.hash(dto.newPassword, 10)                            ← 加密新密码
  5. PrismaService.user.update({ where: { id: userId }, data: { password: hashed } })
```

**前端处理**：改密成功后 `authStore.logout()` + `router.push('/login')`，强制用新密码重新登录。

**DTO**（[auth.dto.ts](file:///d:/personal-site/server/src/modules/auth/dto/auth.dto.ts)）：
```typescript
export class ChangePasswordDto {
  oldPassword: string;   // @IsNotEmpty
  newPassword: string;   // @MinLength(6)
}
```

### 4.7 Token 过期与刷新

当前实现：access token 7 天有效，过期需重新登录。

后续如需 Refresh Token 机制：
1. 签发时同时给 `accessToken`（短期 2h）+ `refreshToken`（长期 7d）
2. `refreshToken` 存 Redis（key `auth:refresh:{jti}`，TTL 7 天）
3. access 过期后，前端用 refresh 换新的 access
4. 退出登录时把 refresh 从 Redis 删除（变相"黑名单"）

---

## 5. 三者协同：完整登录流程

以 `POST /api/auth/login` 为例，三方配合完成鉴权：

```
前端                     NestJS 后端                  MySQL           Redis
 │                          │                          │              │
 │  POST /auth/login        │                          │              │
 │  {username, password,   │                          │              │
 │   captchaId, slideX}     │                          │              │
 │ ──────────────────────► │                          │              │
 │                          │                          │              │
 │                          │  1. CaptchaService.verify(captchaId, slideX)
 │                          │  ──────────────────────────────────────► │
 │                          │  ◄── targetX (Redis get + del 一次性消费) │
 │                          │                          │              │
 │                          │  2. PrismaService.user.findUnique        │
 │                          │  ─────────────────────────► │            │
 │                          │  ◄── user (含 bcrypt password)           │
 │                          │                          │              │
 │                          │  3. bcrypt.compare(password, user.password)
 │                          │     （纯 CPU 计算，无 IO）              │
 │                          │                          │              │
 │                          │  4. JwtService.sign({ sub: user.id, ... })
 │                          │     （生成 accessToken）                 │
 │                          │                          │              │
 │  ◄──────────────────────  │  { accessToken, expiresIn, tokenType: 'Bearer' }
 │                          │                          │              │
 │  后续请求:               │                          │              │
 │  GET /auth/profile       │                          │              │
 │  Authorization: Bearer xxx│                          │              │
 │ ──────────────────────► │                          │              │
 │                          │  JwtAuthGuard → JwtStrategy             │
 │                          │  1. 验签 + 解析 payload.sub              │
 │                          │  2. AuthService.validateUser(sub)        │
 │                          │  ─────────────────────────► │           │
 │                          │  ◄── { id, role, status }                │
 │                          │  3. AuthService.profile(id)              │
 │                          │  ─────────────────────────► │           │
 │                          │  ◄── UserProfile（不含 password）       │
 │  ◄──────────────────────  │  { id, username, nickname, email, avatar, role }
```

---

## 6. 常见问题 FAQ

### Q1: 改了 `schema.prisma` 后报 "Type 'X' is not assignable to ..."？
A: Prisma Client 类型没刷新。运行 `npx prisma generate`，然后 **重启 VS Code TS Server**（`Ctrl+Shift+P` → `TypeScript: Restart TS Server`）。

### Q2: 启动后端时报 `PrismaClientInitializationError: Database connection error`？
A: 检查：
1. MySQL 服务是否启动：`netstat -ano | findstr ":3306"` 应有 `LISTENING`
2. `.env` 中 `DATABASE_URL` 的用户名密码是否正确
3. 数据库是否存在：`init.sql` 里有 `CREATE DATABASE IF NOT EXISTS personal_site`

### Q3: Redis 连接报错但服务能跑？
A: CaptchaService 内置了内存降级（[captcha.service.ts#L101-L108](file:///d:/personal-site/server/src/modules/captcha/captcha.service.ts#L101-L108)），Redis 不可用时验证码会改用内存 Map，但**重启后失效**。生产环境务必保证 Redis 可用。

### Q4: 想新增一张表（如 post），流程？
A:
1. 在 [init.sql](file:///d:/personal-site/server/prisma/init.sql) 末尾追加 `CREATE TABLE post (...)` + 初始数据
2. 执行：`mysql -uroot -pXXX -e "source d:/personal-site/server/prisma/init.sql"`
3. 在 [schema.prisma](file:///d:/personal-site/server/prisma/schema.prisma) 中加 `model Post { ... }`
4. 执行：`cd server && npx prisma generate`
5. 在对应 Service 里：`this.prisma.post.findMany(...)`

### Q5: bcrypt 的 hash 长度多少？字段 varchar 多少合适？
A: bcrypt hash 固定 **60 字符**（`$2b$10$` + 22 字符 salt + 31 字符 hash）。`varchar(100)` 足够。

### Q6: 为什么 PrismaService 不在每个模块里单独 import？
A: `CommonModule` 用了 `@Global()` 装饰器（[common.module.ts#L8](file:///d:/personal-site/server/src/common/common.module.ts#L8)），全局可用。如果非要在子模块用，需要 `imports: [CommonModule]`，但这是冗余写法，**不推荐**。

### Q7: 我修改了 `.env` 但后端没生效？
A: `nest start --watch` 只监听 `.ts` 文件改动，**不监听 `.env`**。需要重启后端（`Ctrl+C` 后重新 `npm run start:dev`）。

### Q8: 浏览器控制台报 CORS 跨域被拦？
A: 检查三个地方：
1. 后端 `.env` 里的 `CORS_ORIGIN` 要包含前端实际运行的 **完整 origin**（协议 + 域名 + 端口），如 `http://127.0.0.1:5173` 和 `http://localhost:5173` 要**同时写**
2. 修改 `.env` 后必须**重启后端**才生效
3. 如果前端用了 vite proxy，确认 proxy 没有把 origin 改掉

**踩坑实录**：前端跑在 `5173` 但 `.env` 只写了 `5175` 的 origin，导致所有 POST 请求的 CORS 预检返回 403。详见 [main.ts#L24-L31](file:///d:/personal-site/server/src/main.ts#L24-L31) 的 CORS 配置。

### Q9: Prisma 可空字段 vs TypeScript 接口非空导致类型报错？
A: Prisma 可空字段（`String?`）的 TS 类型是 `string | null`，但对外 DTO/Interface 可能定义成 `string`。两种处理方式：
- **方式 A（推荐）**：Service 层返回前做 `null` 兜底，如 `nickname: user.nickname ?? user.username`
- **方式 B**：把对外接口改成 `nickname?: string | null`

**踩坑实录**：UserProfile 接口定义 `nickname: string`，Prisma `User.nickname` 是 `String?`，`auth.service.ts` profile 方法直接 `return user` 导致 `TS2322` 编译错误，后端无法启动，前端报"获取验证码失败"（实为后端挂了）。

### Q10: 登录页需要验证码但后端返回"未找到验证码背景图"？
A: 确保 [server/public/captcha-bg/](file:///d:/personal-site/server/public/captcha-bg/) 下有图片（`.jpg` / `.jpeg` / `.png`）。CaptchaService 会从该目录随机选一张 resize 到 300×180。没有图片或目录不存在会直接抛异常。

---

## 附：Auth 模块 API 清单

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | `/api/auth/captcha` | ❌ | 获取滑块验证码（captchaId + base64 图片） |
| POST | `/api/auth/login` | ❌ | 登录（需先通过验证码校验） |
| GET | `/api/auth/profile` | ✅ JwtAuthGuard | 获取当前用户信息（不含 password） |
| POST | `/api/auth/change-password` | ✅ JwtAuthGuard | 修改密码（旧密码 + 新密码） |

---

## 附：相关文件清单

| 类别 | 文件 |
|---|---|
| 配置 | [.env](file:///d:/personal-site/server/.env) · [tsconfig.json](file:///d:/personal-site/server/tsconfig.json) |
| Prisma | [prisma/schema.prisma](file:///d:/personal-site/server/prisma/schema.prisma) · [prisma/init.sql](file:///d:/personal-site/server/prisma/init.sql) · [src/common/prisma.service.ts](file:///d:/personal-site/server/src/common/prisma.service.ts) · [src/common/common.module.ts](file:///d:/personal-site/server/src/common/common.module.ts) |
| Redis | [src/modules/redis/redis.service.ts](file:///d:/personal-site/server/src/modules/redis/redis.service.ts) · [src/modules/redis/redis.module.ts](file:///d:/personal-site/server/src/modules/redis/redis.module.ts) |
| JWT | [src/modules/auth/auth.module.ts](file:///d:/personal-site/server/src/modules/auth/auth.module.ts) · [src/modules/auth/auth.service.ts](file:///d:/personal-site/server/src/modules/auth/auth.service.ts) · [src/modules/auth/strategies/jwt.strategy.ts](file:///d:/personal-site/server/src/modules/auth/strategies/jwt.strategy.ts) · [src/modules/auth/guards/jwt-auth.guard.ts](file:///d:/personal-site/server/src/modules/auth/guards/jwt-auth.guard.ts) |
| Auth DTO | [src/modules/auth/dto/auth.dto.ts](file:///d:/personal-site/server/src/modules/auth/dto/auth.dto.ts)（LoginDto + ChangePasswordDto） |
| 验证码 | [src/modules/captcha/captcha.service.ts](file:///d:/personal-site/server/src/modules/captcha/captcha.service.ts) · [server/public/captcha-bg/](file:///d:/personal-site/server/public/captcha-bg/)（背景图目录） |
| 前端相关 | [src/lib/axios.ts](file:///d:/personal-site/src/lib/axios.ts) · [src/stores/auth.ts](file:///d:/personal-site/src/stores/auth.ts) · [src/components/layout/Header.vue](file:///d:/personal-site/src/components/layout/Header.vue)（登出 + 重置密码入口） · [src/components/ChangePasswordDialog.vue](file:///d:/personal-site/src/components/ChangePasswordDialog.vue)（改密弹窗） |
| 三者协同范例 | [src/modules/auth/auth.service.ts](file:///d:/personal-site/server/src/modules/auth/auth.service.ts)（login + changePassword 方法同时用了 Prisma + Redis + JWT + bcrypt） |

---

## 附二：端到端实测结果（2026-08-28）

用 [server/scripts/verify-auth.js](file:///d:/personal-site/server/scripts/verify-auth.js) 跑通完整登录链路，确认 Prisma + Redis + JWT 三件套协同正常：

```
=== 1. 获取验证码 ===              ← CaptchaService + sharp 生成拼图
  captchaId: bb40d47b-...          ← UUID
  canvasWidth: 300, puzzleSize: 48

=== 2. 从 Redis 读 targetX ===     ← RedisService 验证码缓存生效
  targetX (Redis): 62

=== 3. POST /api/auth/login ===    ← Prisma 查 user + bcrypt.compare + JwtService.sign
  accessToken: eyJhbGciOiJIUzI1...
  expiresIn: 604800 秒              ← 7 天
  tokenType: Bearer

=== 4. GET /api/auth/profile ===    ← JwtAuthGuard → JwtStrategy → AuthService.profile
  profile: { id: 1, username: "admin", nickname: "TE-Fire", role: "admin" }

=== 5. 错误密码测试 ===            ← 业务异常返回统一结构
  HTTP code: 200  Business code: 1004  Message: 用户名或密码错误

✅ 所有测试通过：Prisma + Redis + JWT 三件套协同正常
```

**复跑方式**：

```bash
# 1. 启动后端（确保 MySQL / Redis 已起）
cd server && npm run start:dev

# 2. 跑验证脚本
node scripts/verify-auth.js
```

> 说明：脚本第 5 步的 `HTTP code: 200` 是正常的——后端用 `Result` 统一响应结构，错误也是 HTTP 200 + `code: 1004`，由前端按业务码判断。详见 [result.ts](file:///d:/personal-site/server/src/common/result.ts) 和 [exception.ts](file:///d:/personal-site/server/src/common/exception.ts)。

---

**最后更新**：2026-08-28 · auth 模块完成登录 + 改密 + 跑通全链路 + CORS 配置说明
