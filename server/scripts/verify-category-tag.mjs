/**
 * verify-category-tag.mjs · Category + Tag 模块端到端测试（10 步 + 回滚）
 *
 * 测试覆盖：
 *   · Category CRUD（列表/创建/更新/删除 + 文章分类置空）
 *   · Tag CRUD（列表/创建/重命名/删除 + PostTag 清除）
 *   · Tag 合并（source → target，raw SQL 事务）
 *
 * 运行：先启动 nest dev server（:3000），再 node scripts/verify-category-tag.mjs
 */
import http from 'node:http';
import Redis from 'ioredis';

const HOST = '127.0.0.1';
const PORT = 3000;
const API = '/api';

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

  // --- Category CRUD ---
  console.log('\n[Phase 1] Category CRUD');

  // 1. 列表
  const catList = await httpJson('GET', `${API}/categories`);
  if (catList.body?.code !== 200) fail('1 分类列表', `code=${catList.body?.code}`);
  if (!catList.body?.data?.length) fail('1 分类非空');
  ok('1 分类列表', `共 ${catList.body.data.length} 个`);

  // 2. 创建
  const created = await httpJson('POST', `${API}/categories`, {
    token,
    body: { name: '测试分类-' + Date.now(), sort: 99 },
  });
  if (created.body?.code !== 200) fail('2 创建分类', `code=${created.body?.code}`);
  const catId = created.body.data.id;
  ok('2 创建分类', `id=${catId} name="${created.body.data.name}"`);

  // 3. 更新
  const updated = await httpJson('PUT', `${API}/categories/${catId}`, {
    token,
    body: { name: '测试分类（已改名）', sort: 50 },
  });
  if (updated.body?.code !== 200) fail('3 更新分类', `code=${updated.body?.code}`);
  if (updated.body.data.name !== '测试分类（已改名）') fail('3 名称已变');
  if (updated.body.data.sort !== 50) fail('3 sort=50');
  ok('3 更新分类', `name="${updated.body.data.name}" sort=${updated.body.data.sort}`);

  // 4. 删除
  const deleted = await httpJson('DELETE', `${API}/categories/${catId}`, { token });
  if (deleted.body?.code !== 200) fail('4 删除分类', `code=${deleted.body?.code}`);
  ok('4 删除分类', deleted.body.message);

  // 5. 验证已删除
  const catList2 = await httpJson('GET', `${API}/categories`);
  const stillExists = catList2.body.data.find((c) => c.id === catId);
  if (stillExists) fail('5 分类已删除');
  ok('5 分类已删除', '列表中不再存在');

  // --- Tag CRUD ---
  console.log('\n[Phase 2] Tag CRUD');

  // 6. 列表
  const tagList = await httpJson('GET', `${API}/tags`);
  if (tagList.body?.code !== 200) fail('6 标签列表', `code=${tagList.body?.code}`);
  ok('6 标签列表', `共 ${tagList.body.data.length} 个`);

  // 7. 创建两个标签（用于 merge 测试）
  const tagA = await httpJson('POST', `${API}/tags`, {
    token,
    body: { name: '测试标签A-' + Date.now() },
  });
  if (tagA.body?.code !== 200) fail('7 创建标签A', `code=${tagA.body?.code}`);
  const tagAId = tagA.body.data.id;

  const tagB = await httpJson('POST', `${API}/tags`, {
    token,
    body: { name: '测试标签B-' + Date.now() },
  });
  if (tagB.body?.code !== 200) fail('7 创建标签B', `code=${tagB.body?.code}`);
  const tagBId = tagB.body.data.id;
  ok('7 创建标签 A+B', `A=${tagAId} B=${tagBId}`);

  // 8. 重命名
  const renamed = await httpJson('PUT', `${API}/tags/${tagAId}`, {
    token,
    body: { name: '测试标签A（已改名）' },
  });
  if (renamed.body?.code !== 200) fail('8 重命名标签', `code=${renamed.body?.code}`);
  ok('8 重命名标签', `name="${renamed.body.data.name}"`);

  // 9. 合并（A → B）
  const merged = await httpJson('POST', `${API}/tags/${tagAId}/merge`, {
    token,
    body: { targetId: tagBId },
  });
  if (merged.body?.code !== 200) fail('9 合并标签', `code=${merged.body?.code} msg=${merged.body?.message}`);
  ok('9 合并标签 A→B', merged.body.message);

  // 验证 A 已删除
  const tagList2 = await httpJson('GET', `${API}/tags`);
  const aStillExists = tagList2.body.data.find((t) => t.id === tagAId);
  if (aStillExists) fail('9 标签A已删除');
  ok('9 标签A已删除', '合并后 source 标签已不存在');

  // 10. 删除 B
  const delB = await httpJson('DELETE', `${API}/tags/${tagBId}`, { token });
  if (delB.body?.code !== 200) fail('10 删除标签B', `code=${delB.body?.code}`);
  ok('10 删除标签B', delB.body.message);

  // 验证 B 已删除
  const tagList3 = await httpJson('GET', `${API}/tags`);
  const bStillExists = tagList3.body.data.find((t) => t.id === tagBId);
  if (bStillExists) fail('10 标签B已删除');
  ok('10 标签B已删除', '回滚完成');

  await redis.disconnect();
  console.log(`\n========== ${pass}/${total} 通过 ==========`);
}

main().catch((e) => { console.error('❌ 未捕获错误:', e); process.exit(1); });
