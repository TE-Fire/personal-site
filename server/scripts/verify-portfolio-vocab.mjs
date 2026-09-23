/**
 * verify-portfolio-vocab.mjs · Portfolio 词库管理端到端验证
 *
 * 覆盖：
 *   1. 登录拿 JWT
 *   2. GET  /api/portfolio/admin/meta        词库并集
 *   3. POST /api/portfolio/admin/meta/TAG    新增词条
 *   4. 创建临时作品（引用新词条）
 *   5. PUT  重命名词条 → 作品数据同步
 *   6. DELETE 标签词条 → 从作品 tags 中剥离
 *   7. DELETE 被引用分类 → 7006 拒绝；重命名分类=合并 → 作品同步
 *   8. 清理临时作品，词库回归
 */
const BASE = 'http://127.0.0.1:3000/api';
const REDIS_KEY_PREFIX = 'personal_site:captcha:'; // CAPTCHA_KEY(uuid)

/* 登录带滑块验证码：与 verify-auth.js 相同 —— 从 Redis 直接读 targetX 模拟滑到位 */
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
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const stamp = Date.now().toString(36);
const TMP_TAG = `__e2e_tag_${stamp}`;
const TMP_TAG2 = `__e2e_tag2_${stamp}`;
const TMP_CAT = `__e2e_cat_${stamp}`;
const TMP_SLUG = `__e2e_work_${stamp}`;

async function main() {
  /* 1. 登录 */
  const loginRes = await login();
  const token = loginRes.json?.data?.accessToken;
  report('登录获取 JWT', !!token, token ? '' : JSON.stringify(loginRes.json).slice(0, 120));
  if (!token) return;

  /* 2. 词库基线 */
  const meta0 = await api('GET', '/portfolio/admin/meta', { token });
  const cat0 = meta0.json?.data?.categories?.length ?? -1;
  const tag0 = meta0.json?.data?.tags?.length ?? -1;
  report(
    'GET admin/meta 返回词库并集',
    meta0.status === 200 && cat0 >= 0 && tag0 >= 0,
    `categories=${cat0}, tags=${tag0}`,
  );

  /* 3. 新增词条 */
  await api('POST', '/portfolio/admin/meta/TAG', { token, body: { name: TMP_TAG } });
  await api('POST', '/portfolio/admin/meta/CATEGORY', { token, body: { name: TMP_CAT } });
  const meta1 = await api('GET', '/portfolio/admin/meta', { token });
  report(
    'POST 新增分类/标签词条',
    meta1.json?.data?.tags?.includes(TMP_TAG) && meta1.json?.data?.categories?.includes(TMP_CAT),
  );

  /* 3.1 重名新增应报错 */
  const dup = await api('POST', '/portfolio/admin/meta/TAG', { token, body: { name: TMP_TAG } });
  report('重名词条被拒绝', dup.json?.code === 7004, `code=${dup.json?.code}`);

  /* 4. 创建临时作品引用词条 */
  const created = await api('POST', '/portfolio', {
    token,
    body: {
      slug: TMP_SLUG,
      title: '__E2E 临时作品',
      description: '词库验证用，结束后删除',
      tags: [TMP_TAG],
      category: TMP_CAT,
      status: 'PUBLISHED',
    },
  });
  const workId = created.json?.data?.id;
  report('创建临时作品', !!workId, `id=${workId}`);

  /* 5. 重命名标签 → 作品同步 */
  await api('PUT', '/portfolio/admin/meta/TAG', {
    token,
    body: { from: TMP_TAG, to: TMP_TAG2 },
  });
  const detail1 = await api('GET', `/portfolio/${TMP_SLUG}`);
  report(
    '重命名标签后作品 tags 同步',
    Array.isArray(detail1.json?.data?.tags) && detail1.json.data.tags.includes(TMP_TAG2),
    JSON.stringify(detail1.json?.data?.tags),
  );

  /* 6. 删除标签 → 从作品中剥离 */
  await api('DELETE', `/portfolio/admin/meta/TAG/${encodeURIComponent(TMP_TAG2)}`, { token });
  const detail2 = await api('GET', `/portfolio/${TMP_SLUG}`);
  report(
    '删除标签后作品 tags 已剥离',
    Array.isArray(detail2.json?.data?.tags) && detail2.json.data.tags.length === 0,
    JSON.stringify(detail2.json?.data?.tags),
  );

  /* 7. 被引用分类删除应拒绝（7006），合并后放行 */
  const delBlocked = await api('DELETE', `/portfolio/admin/meta/CATEGORY/${encodeURIComponent(TMP_CAT)}`, { token });
  report('被引用分类删除被拒绝(7006)', delBlocked.json?.code === 7006, `code=${delBlocked.json?.code}`);

  await api('PUT', '/portfolio/admin/meta/CATEGORY', {
    token,
    body: { from: TMP_CAT, to: '独立项目' },
  });
  const detail3 = await api('GET', `/portfolio/${TMP_SLUG}`);
  report(
    '分类合并后作品 category 同步',
    detail3.json?.data?.category === '独立项目',
    `category=${detail3.json?.data?.category}`,
  );

  /* 7.1 公开列表缓存已被失效（列表里能直接看到合并后的值） */
  const pub = await api('GET', '/portfolio');
  const pubWork = (pub.json?.data || []).find((w) => w.slug === TMP_SLUG);
  report(
    '公开列表缓存已失效并读到新值',
    !!pubWork && pubWork.category === '独立项目',
    pubWork ? `category=${pubWork.category}` : 'work not found',
  );

  /* 8. 清理 */
  if (workId) await api('DELETE', `/portfolio/${workId}`, { token });
  const meta2 = await api('GET', '/portfolio/admin/meta', { token });
  const clean =
    !meta2.json?.data?.tags?.some((t) => t.startsWith('__e2e')) &&
    !meta2.json?.data?.categories?.some((c) => c.startsWith('__e2e'));
  report('清理临时数据，词库回归', clean);

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n=== 结果：${pass}/${results.length} 通过 ===`);
  process.exit(pass === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error('脚本异常：', e.message);
  process.exit(1);
});
