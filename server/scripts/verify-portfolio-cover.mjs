/**
 * verify-portfolio-cover.mjs · 作品封面图上传端到端验证
 *
 * 覆盖：
 *   1. 登录拿 JWT
 *   2. POST /api/portfolio/upload 上传 1x1 PNG → 返回 /uploads/works/xx.png
 *   3. 上传非图片格式 → 7008 拒绝
 *   4. 创建作品带 coverImage → 列表 / 详情均回显
 *   5. 公开列表缓存失效后能读到 coverImage
 *   6. 删除作品 → 本地封面文件被清理
 */
import { existsSync, writeFileSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';

const BASE = 'http://127.0.0.1:3000/api';
const REDIS_KEY_PREFIX = 'personal_site:captcha:';

/* 1x1 透明 PNG */
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function login() {
  const captcha = await api('GET', '/auth/captcha');
  const { captchaId } = captcha.json?.data || {};
  if (!captchaId) throw new Error('获取验证码失败');
  const { default: Redis } = await import('ioredis');
  const r = new Redis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: 1 });
  const targetX = await r.get(`${REDIS_KEY_PREFIX}${captchaId}`);
  await r.quit();
  if (!targetX) throw new Error('Redis 里没找到 targetX');
  return api('POST', '/auth/login', {
    body: {
      username: 'admin',
      password: 'admin123',
      captchaId,
      slideX: Number(targetX),
    },
  });
}

const results = [];
function report(name, ok, detail = '') {
  results.push(ok);
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const stamp = Date.now().toString(36);
const TMP_SLUG = `__e2e_cover_${stamp}`;

async function main() {
  const loginRes = await login();
  const token = loginRes.json?.data?.accessToken;
  report('登录获取 JWT', !!token, token ? '' : JSON.stringify(loginRes.json).slice(0, 150));
  if (!token) return;

  /* 2. 上传合法 PNG */
  const file = join(process.cwd(), `__e2e_cover_${stamp}.png`);
  writeFileSync(file, Buffer.from(PNG_B64, 'base64'));
  let fd = new FormData();
  fd.append('file', new Blob([Buffer.from(PNG_B64, 'base64')], { type: 'image/png' }), 'cover.png');
  const up = await fetch(`${BASE}/portfolio/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const upJson = await up.json().catch(() => ({}));
  const coverUrl = upJson?.data?.url;
  report(
    'POST /portfolio/upload 上传 PNG',
    [200, 201].includes(up.status) && !!coverUrl?.startsWith('/uploads/works/'),
    coverUrl || JSON.stringify(upJson).slice(0, 150),
  );

  /* 3. 非图片格式应被拒绝（7008） */
  fd = new FormData();
  fd.append('file', new Blob([Buffer.from('not-image')], { type: 'text/plain' }), 'x.txt');
  const bad = await fetch(`${BASE}/portfolio/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const badJson = await bad.json().catch(() => ({}));
  report(
    '上传 txt → 拒绝（code 7008）',
    badJson?.code === 7008,
    `code=${badJson?.code} msg=${badJson?.message}`,
  );

  if (!coverUrl) return;

  /* 4. 创建作品带封面图 */
  const created = await api('POST', '/portfolio', {
    token,
    body: {
      slug: TMP_SLUG,
      title: 'E2E 封面图测试',
      description: '临时数据，验证后可删',
      cover: 'linear-gradient(135deg, #4B3FE3 0%, #27D2BF 100%)',
      coverImage: coverUrl,
      tags: ['E2E'],
      category: '独立项目',
      status: 'PUBLISHED',
    },
  });
  const id = created.json?.data?.id;
  report(
    '创建作品回显 coverImage',
    [200, 201].includes(created.status) && created.json?.data?.coverImage === coverUrl,
    `id=${id}`,
  );

  /* 5. 公开详情能读到 coverImage（缓存已失效） */
  const detail = await api('GET', `/portfolio/${TMP_SLUG}`);
  report(
    '公开详情 GET /:slug 含 coverImage',
    detail.json?.data?.coverImage === coverUrl,
    detail.json?.data?.coverImage || JSON.stringify(detail.json).slice(0, 120),
  );

  const list = await api('GET', '/portfolio');
  const inList = (list.json?.data || []).find((w) => w.slug === TMP_SLUG);
  report('公开列表含该作品且带封面图', inList?.coverImage === coverUrl, `found=${!!inList}`);

  /* 6. 删除作品 → 文件清理 */
  const del = await api('DELETE', `/portfolio/${id}`, { token });
  report('删除作品', del.status === 200, `status=${del.status}`);

  const worksDir = join(process.cwd(), 'public', 'uploads', 'works');
  console.log('   上传目录快照：', readdirSync(worksDir));
  const diskPath = join(worksDir, coverUrl.split('/').pop());
  report('封面文件已随作品删除清理', !existsSync(diskPath), diskPath);

  rmSync(file, { force: true });
  const pass = results.filter(Boolean).length;
  console.log(`\n${pass}/${results.length} 通过`);
}

main().catch((e) => {
  console.error('致命错误：', e.message);
  process.exit(1);
});
