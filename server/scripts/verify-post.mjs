/**
 * verify-post.mjs · Post 模块端到端测试（12 步 + 回滚）
 *
 * 测试覆盖：
 *   · 游客列表/详情查询
 *   · Redis 缓存命中（详情 + 空值缓存防穿透）
 *   · 博主创建/更新/删除
 *   · 缓存失效（update 后查新数据）
 *   · 权限控制（游客不可见草稿/归档）
 *
 * 复用 verify-contribution2.mjs 的 node:http + ioredis 风格。
 * 运行：先启动 nest dev server（:3000），再 node scripts/verify-post.mjs
 */
import http from 'node:http';
import Redis from 'ioredis';

const HOST = '127.0.0.1';
const PORT = 3000;
const API = '/api';
const REDIS_KEY = (s) => `personal_site:cache:post:detail:slug:${s}`;
const REDIS_ID_KEY = (id) => `personal_site:cache:post:detail:id:${id}`;

/* ---------------- 工具 ---------------- */
function httpJson(method, path, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {};
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = http.request(
      { host: HOST, port: PORT, path, method, headers },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let parsed = null;
          try { parsed = data ? JSON.parse(data) : null; } catch { /* ignore */ }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

let pass = 0, total = 0;
function ok(name, extra = '') {
  total++; pass++;
  console.log(`  [${total}] ✅ ${name}${extra ? ' — ' + extra : ''}`);
}
function fail(name, extra = '') {
  total++;
  console.log(`  [${total}] ❌ ${name}${extra ? ' — ' + extra : ''}`);
  process.exit(1);
}

/* ---------------- 登录 ---------------- */
async function login(redis) {
  console.log('\n[前置 0] 滑块验证码 + 登录拿 Token');
  const cap = await httpJson('GET', `${API}/auth/captcha`);
  if (cap.body?.code !== 200 || !cap.body?.data?.captchaId) {
    fail('0.0 验证码获取', `code=${cap.body?.code}`);
  }
  const captchaId = cap.body.data.captchaId;
  const targetX = await redis.get(`personal_site:captcha:${captchaId}`);
  if (targetX == null) fail('0.1 Redis captcha key');
  const loginR = await httpJson('POST', `${API}/auth/login`, {
    body: { username: 'admin', password: 'admin123', captchaId, slideX: Number(targetX) || 150 },
  });
  if (loginR.body?.code !== 200) fail('0.2 登录', `code=${loginR.body?.code}`);
  const token = loginR.body?.data?.accessToken;
  if (!token) fail('0.3 accessToken');
  ok('前置 0 滑块 + 登录', `token len=${token.length}`);
  return token;
}

/* ---------------- 主测试 ---------------- */
async function main() {
  const redis = new Redis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: 1 });
  const token = await login(redis);

  const SLUG = 'vibecoding-in-practice'; // seed 导入的第一篇文章

  // --- 游客查询 ---
  console.log('\n[Phase 1] 游客查询');

  // 1. 列表
  const list = await httpJson('GET', `${API}/posts?page=1&pageSize=5`);
  if (list.body?.code !== 200) fail('1 列表 code=200', `code=${list.body?.code}`);
  if (!list.body?.data?.list || list.body.data.list.length === 0) fail('1 列表非空');
  if (list.body.data.list[0].content !== undefined) fail('1 列表 content=undefined');
  ok('1 游客列表', `total=${list.body.data.total} 条，content=undefined`);

  // 2. 详情（slug）
  const detail1 = await httpJson('GET', `${API}/posts/slug/${SLUG}`);
  if (detail1.body?.code !== 200) fail('2 详情 code=200', `code=${detail1.body?.code}`);
  if (!detail1.body?.data?.content) fail('2 详情 content 非空');
  ok('2 游客详情(slug)', `${detail1.body.data.title.slice(0, 20)}...`);

  // 3. 缓存命中验证
  const cache1 = await redis.get(REDIS_KEY(SLUG));
  if (!cache1 || cache1 === '{"__null__":true}') fail('3 缓存命中', 'Redis key 不存在或为 NULL_FLAG');
  ok('3 Redis 缓存命中', `key=${REDIS_KEY(SLUG).slice(0, 50)}...`);

  // --- 防穿透 ---
  console.log('\n[Phase 2] 防穿透');

  // 4. 查不存在的 slug
  const FAKE_SLUG = 'this-slug-does-not-exist-xyz';
  const notFound = await httpJson('GET', `${API}/posts/slug/${FAKE_SLUG}`);
  if (notFound.body?.code === 200) fail('4 不存在文章返回错误', 'code=200 不对');
  ok('4 防穿透 404', `code=${notFound.body?.code} msg=${notFound.body?.message}`);

  // 5. 空值缓存验证
  const nullCache = await redis.get(REDIS_KEY(FAKE_SLUG));
  if (nullCache !== '{"__null__":true}') fail('5 空值缓存', `value=${nullCache}`);
  ok('5 NULL_FLAG 缓存命中', `TTL=60s 防穿透`);

  // --- 博主写入 ---
  console.log('\n[Phase 3] 博主写入');

  // 6. 创建
  const createSlug = 'test-post-verify-' + Date.now();
  const created = await httpJson('POST', `${API}/posts`, {
    token,
    body: {
      slug: createSlug,
      title: '测试文章（verify-post 自动生成）',
      excerpt: '这是端到端测试创建的文章',
      content: '# 测试\n\n这是一篇测试文章。',
      status: 'published',
      featured: false,
    },
  });
  if (created.body?.code !== 200) fail('6 创建', `code=${created.body?.code} msg=${created.body?.message}`);
  const newId = created.body.data.id;
  ok('6 创建文章', `id=${newId} slug=${createSlug}`);

  // 7. 更新
  const updated = await httpJson('PUT', `${API}/posts/${newId}`, {
    token,
    body: { title: '测试文章（已更新标题）', content: '# 更新后\n\n正文变了。' },
  });
  if (updated.body?.code !== 200) fail('7 更新', `code=${updated.body?.code}`);
  if (updated.body.data.title !== '测试文章（已更新标题）') fail('7 标题已变');
  ok('7 更新文章', `新标题="${updated.body.data.title}"`);

  // 8. 缓存失效验证 — 更新后游客查应该看到新标题
  const afterUpdate = await httpJson('GET', `${API}/posts/slug/${createSlug}`);
  if (afterUpdate.body?.data?.title !== '测试文章（已更新标题）') {
    fail('8 缓存失效后查到新数据', `title=${afterUpdate.body?.data?.title}`);
  }
  ok('8 缓存失效 + 新数据', `title="${afterUpdate.body.data.title}"`);

  // --- 软删除 + 权限 ---
  console.log('\n[Phase 4] 软删除 + 权限');

  // 9. 软删除（归档）
  const deleted = await httpJson('DELETE', `${API}/posts/${newId}`, { token });
  if (deleted.body?.code !== 200) fail('9 软删除', `code=${deleted.body?.code}`);
  ok('9 软删除(ARCHIVED)', deleted.body.message);

  // 10. 游客查归档文章 → 404
  const archived = await httpJson('GET', `${API}/posts/${newId}`);
  if (archived.body?.code === 200) fail('10 游客不可见归档', 'code=200 不对');
  ok('10 游客不可见归档', `code=${archived.body?.code}`);

  // --- 博主可见归档 ---
  // 11. 博主查归档文章
  const archivedAdmin = await httpJson('GET', `${API}/posts/${newId}`, { token });
  if (archivedAdmin.body?.code !== 200) fail('11 博主可见归档', `code=${archivedAdmin.body?.code}`);
  if (archivedAdmin.body.data.status !== 'archived') fail('11 status=archived', `status=${archivedAdmin.body.data.status}`);
  ok('11 博主可见归档', `status=${archivedAdmin.body.data.status}`);

  // --- 回滚 ---
  console.log('\n[Phase 5] 回滚');
  // 12. 物理删除测试文章
  const hardDel = await httpJson('DELETE', `${API}/posts/${newId}?hard=true`, { token });
  if (hardDel.body?.code !== 200) fail('12 物理删除', `code=${hardDel.body?.code}`);
  ok('12 物理删除测试文章', '回滚完成');

  // 清理 Redis 测试 key
  await redis.del(REDIS_KEY(FAKE_SLUG));
  await redis.del(REDIS_KEY(createSlug));
  await redis.del(REDIS_ID_KEY(newId));
  await redis.disconnect();

  console.log(`\n========== ${pass}/${total} 通过 ==========`);
}

main().catch((e) => { console.error('❌ 未捕获错误:', e); process.exit(1); });
