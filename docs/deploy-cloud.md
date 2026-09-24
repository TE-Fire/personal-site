# 个人站点（personal-site）云端部署教程

> 目标：把 `D:\personal-site`（Vue3 + Vite 前端 / NestJS + Prisma + MySQL + Redis 后端）从 0 部署到一台云服务器，并让公网通过域名 HTTPS 访问。
>
> 适用系统：服务器端以 **Ubuntu 22.04 LTS** 为例（其他 Linux 发行版命令类似）。
> 部署架构：**Nginx 托管前端静态文件 + 反向代理 `/api`、`/uploads` 到 NestJS（PM2 守护）**，MySQL / Redis 直接装在服务器上。

---

## 0. 架构与目录说明

```
浏览器
  │  https://yourdomain.com
  ▼
Nginx (80/443)
  ├── /            → 前端静态文件 (dist/)
  ├── /api/*       → 127.0.0.1:3000/api/*   (NestJS)
  ├── /uploads/*   → 127.0.0.1:3000/uploads/* (NestJS 托管的 public 目录)
  └── /health      → 127.0.0.1:3000/health

NestJS (PM2, 端口 3000)
  ├── Prisma Client → MySQL 3306
  └── ioredis      → Redis 6379
```

关键点（已核对代码）：
- 前端 `src/lib/axios.ts` 默认 `baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'`。
  **线上必须设 `VITE_API_BASE_URL=/api`**，否则前端会去请求 `localhost:3000`。
- 前端使用 **Hash 路由**（`#/xxx`），任意路径都只请求 `/`，Nginx 不需要 history fallback 重写。
- 后端 `server/src/main.ts`：`useStaticAssets(server/public, {prefix:'/'})` 托管上传文件；监听 `PORT`（默认 3000）；全局前缀 `api`。
- 后端**无 migration 目录**，用 `prisma db push` 推表结构；管理员账号由 `server/prisma/init.sql` 注入。

---

## 1. 准备云服务器

1. 购买一台云服务器（阿里云/腾讯云/华为云/AWS 均可），推荐 **2 核 2G 以上**，系统镜像选 **Ubuntu 22.04 LTS**。
2. 在云厂商「安全组 / 防火墙」放通端口：`22`（SSH）、`80`（HTTP）、`443`（HTTPS）。`3000` **不要**对外放通（只走内网 Nginx 代理）。
3. 记录服务器 **公网 IP**。

> 可选但推荐：买一个域名，把 `A 记录` 指向该公网 IP（教程第 11 步用）。没有域名也能用 `http://公网IP` 临时访问。

---

## 2. 登录与基础初始化

```bash
# 本地终端 SSH 登录（把 1.2.3.4 换成你的公网 IP）
ssh root@1.2.3.4
```

登录后更新系统并创建专用用户（可选但安全）：

```bash
sudo apt update && sudo apt -y upgrade
sudo adduser deploy        # 按提示设置密码
sudo usermod -aG sudo deploy
# 之后建议用 deploy 用户操作，下同
```

---

## 3. 安装运行环境

### 3.1 编译工具（sharp / bcrypt 需要）
```bash
sudo apt -y install build-essential python3
```

### 3.2 Node.js 20 LTS（用 NodeSource）
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs
node -v   # 期望 v20.x
npm -v    # 期望 9.x/10.x
```

### 3.3 PM2（进程守护）
```bash
sudo npm i -g pm2
```

### 3.4 MySQL 8
```bash
sudo apt -y install mysql-server
sudo mysql_secure_installation   # 按提示设 root 密码、移除匿名用户等
```

### 3.5 Redis
```bash
sudo apt -y install redis-server
sudo systemctl enable --now redis-server
redis-cli ping   # 期望返回 PONG
```

### 3.6 Nginx
```bash
sudo apt -y install nginx
sudo systemctl enable --now nginx
```

---

## 4. 初始化数据库与 Redis 用户

```bash
sudo mysql -u root -p
```

在 MySQL 交互界面执行：

```sql
CREATE DATABASE IF NOT EXISTS personal_site
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

-- 建一个专用账号（密码请改成强密码）
CREATE USER IF NOT EXISTS 'ps_user'@'127.0.0.1' IDENTIFIED BY 'YourDbPass123!';
GRANT ALL PRIVILEGES ON personal_site.* TO 'ps_user'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

Redis 默认监听 `127.0.0.1:6379` 且无需密码即可本地连接，后端 `REDIS_HOST=127.0.0.1` 即可。

---

## 5. 获取代码

在服务器上（建议放在 `/var/www/`）：

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone <你的仓库地址> personal-site
cd personal-site
```

> 如果还没推到远程仓库，可在**本地**打包 `server/` 和前端 `dist/` 后 `scp` 到服务器，跳过 git。

---

## 6. 配置环境变量

### 6.1 前端（构建期注入，必须！）

在项目**根目录**创建 `.env`（或 `.env.production`）：

```bash
cd /var/www/personal-site
cat > .env <<'EOF'
# 前端请求后端的基址；同域部署用相对路径 /api
VITE_API_BASE_URL=/api
EOF
```

### 6.2 后端

```bash
cd /var/www/personal-site/server
cp .env.example .env
nano .env
```

按生产环境修改：

```ini
NODE_ENV=production
PORT=3000
API_PREFIX=api

# 数据库（用第 4 步建的账号）
DATABASE_URL="mysql://ps_user:YourDbPass123!@127.0.0.1:3306/personal_site?useUnicode=true&characterEncoding=utf8mb4"

# JWT（务必改成随机长字符串）
JWT_SECRET=请改成至少32位随机字符串例如$(openssl rand -hex 16)
JWT_EXPIRES_IN=7d

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# CORS：填你的公网域名（没有域名先填 http://公网IP）
CORS_ORIGIN=https://yourdomain.com
```

---

## 7. 构建

### 方式 A（推荐，省服务器资源）：前端在本地构建，只把 `dist/` 传上去

**本地终端**：
```bash
cd D:\personal-site
echo VITE_API_BASE_URL=/api > .env
npm install
npm run build          # 生成 dist/
# 把 dist/ 传到服务器
scp -r dist deploy@1.2.3.4:/var/www/personal-site/dist
```

### 方式 B：全在服务器构建

```bash
cd /var/www/personal-site
npm install
npm run build          # 会跑 vue-tsc -b && vite build
```

### 后端构建（两种方式的服务器都要做）

```bash
cd /var/www/personal-site/server
npm install
npx prisma generate    # 生成 Prisma Client
npx prisma db push     # 按 schema 把表结构推到 MySQL（无 migration 目录，用 push）
npm run build          # nest build → dist/main.js
```

---

## 8. 初始化数据（管理员 + 种子）

```bash
cd /var/www/personal-site/server

# 1) 注入管理员账号（admin / admin123，来自 init.sql 的 bcrypt 密文）
sudo mysql -u root -p personal_site < prisma/init.sql

# 2) 可选：补充关于页 / 作品 / 时间线 / 文章 等默认数据
node scripts/seed-about-defaults.mjs
node prisma/seed-timeline.mjs
node prisma/seed-works.mjs
node scripts/seed-posts.mjs
```

> 若 `init.sql` 与当前 Prisma schema 字段不一致，可改用 Prisma Studio 手动建管理员：
> `npx prisma studio` → 打开浏览器 → 在 `user` 表插入一条 `role=admin` 的记录（密码需 bcrypt 密文）。

---

## 9. 用 PM2 启动后端

在 `server/` 目录创建 `ecosystem.config.js`：

```bash
cd /var/www/personal-site/server
cat > ecosystem.config.js <<'EOF'
module.exports = {
  apps: [{
    name: 'personal-site-server',
    script: 'dist/main.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: { NODE_ENV: 'production' },
  }],
};
EOF

pm2 start ecosystem.config.js
pm2 save
pm2 startup   # 按提示把生成的命令粘回去执行，实现开机自启
```

验证后端：

```bash
curl http://127.0.0.1:3000/health
# 期望返回健康信息（非 404/500）
```

---

## 10. Nginx：托管前端 + 反向代理

创建站点配置：

```bash
sudo nano /etc/nginx/sites-available/personal-site
```

内容（把 `yourdomain.com` 换成你的域名或公网 IP）：

```nginx
server {
    listen 80;
    server_name yourdomain.com;   # 没有域名就写服务器公网 IP

    # 前端静态文件
    root /var/www/personal-site/dist;
    index index.html;

    # Hash 路由，任意路径都回 index.html（保险）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 上传文件（头像 / 封面 / 二维码等）
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000/uploads/;
        proxy_set_header Host $host;
    }

    # 健康检查
    location /health {
        proxy_pass http://127.0.0.1:3000/health;
    }
}
```

启用并重启：

```bash
sudo ln -s /etc/nginx/sites-available/personal-site /etc/nginx/sites-enabled/
sudo nginx -t      # 检查配置语法
sudo systemctl reload nginx
```

现在用浏览器打开 `http://公网IP`（或域名）应能看到站点。

---

## 11. 域名 + HTTPS（可选但强烈建议）

1. 域名控制台把 `A 记录` 指向服务器公网 IP。
2. 安装 certbot 并签发证书：

```bash
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

certbot 会自动把 80 跳转 443 并配置证书，续期也自动。

---

## 12. 验证清单

- [ ] `http://域名` 或 `http://公网IP` 打开首页正常
- [ ] `/contact` 能加载、微信二维码弹窗正常
- [ ] 登录 `/login` 用 `admin / admin123` 能进后台
- [ ] 上传图片后 `/uploads/...` 可访问（Nginx 代理生效）
- [ ] `https://域名/api/docs` 能看到 Swagger
- [ ] `pm2 logs personal-site-server` 无报错

---

## 13. 后续更新流程

```bash
cd /var/www/personal-site
git pull

# 前端有改动（方式 A）：本地重新 build 后 scp dist/；方式 B 直接：
npm install && npm run build

# 后端有改动
cd server
npm install
npx prisma generate
npx prisma db push      # schema 变了才需要
npm run build
pm2 reload personal-site-server
sudo systemctl reload nginx   # 仅当改了 nginx 配置
```

---

## 14. 备选：单体部署（前端塞进后端 public）

如果不想单独用 Nginx 托管前端，可把构建后的 `dist/*` 复制到 `server/public/`，然后**只跑后端**，让 NestJS 同时托管页面和接口：

```bash
cp -r dist/* server/public/
cd server && pm2 start ecosystem.config.js
```

再用 Nginx（或直接防火墙放 3000）把 80/443 代理到 3000 即可。缺点是前端静态资源和 API 共用一个 Node 进程，性能与缓存不如 Nginx 分离方案。

---

## 15. 常见问题排查

| 现象 | 原因 / 解决 |
|------|--------------|
| 页面能开，但所有接口 404 / 请求到 localhost | 前端构建前没设 `VITE_API_BASE_URL=/api`，重新 build |
| 接口 403 CORS | 后端 `CORS_ORIGIN` 没包含当前域名，改 `.env` 后重启 PM2 |
| `PrismaClientKnownRequestError` / 表不存在 | 没跑 `npx prisma db push` |
| 登录提示密码错 | `init.sql` 未执行或 admin 密码被改；用 Prisma Studio 重置 |
| 上传图片 404 | `/uploads` 没代理到后端，或 `server/public/uploads` 目录未创建（后端启动会自动建 avatar 目录） |
| PM2 进程起不来 | `pm2 logs` 看报错；多半是 `.env` 缺失或 `DATABASE_URL` 连不上 |
| 服务器重启后服务没起来 | 没执行 `pm2 startup` + `pm2 save` |

---

## 附：最小服务器资源建议

- 前端静态：几乎零额外开销（Nginx 处理）
- 后端 Node：约 150–300MB 内存
- MySQL：约 300–500MB
- Redis：约 30–80MB

**最低配置**：1 核 2G 能跑（建议加 1G swap）；舒适配置 2 核 4G。
