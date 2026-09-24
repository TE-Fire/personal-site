/**
 * verify-timeline.mjs · 经历时间线模块端到端验证
 *
 * 覆盖（公开读 + 管理写 + 缓存 + 校验）：
 *   1. 登录拿 JWT（带滑块验证码，从 Redis 读 targetX）
 *   2. GET  /api/timeline                公开列表（seed 6 条，按 startedAt 倒序）
 *   3. GET  /api/timeline/admin/list     管理列表（需 JWT）
 *   4. GET  /api/timeline/admin/meta     候选标签（需 JWT）
 *   5. POST /api/timeline                新建（visible=false，不应出现在公开列表）
 *   6. PUT  /api/timeline/:id            更新（visible=true + ongoing=true）
 *   7. 校验：ongoing=true 时 endedAt 被强制清空；公开列表缓存已失效并能读到新条目
 *   8. 校验：结束时间早于开始时间 → 8004 拒绝；开始时间格式非法 → 8004 拒绝
 *   9. DELETE /api/timeline/:id          删除 → 公开列表不再包含，且恢复到 seed 条数
 */
const BASE = 'http://127.0.0.1:3000/api';
const REDIS_KEY_PREFIX = 'personal_site:captcha:'; // CAPTCHA_KEY(uuid)

/** 登录带滑块验证码：从 Redis 直接读 targetX 模拟滑到位 */
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
const TMP_TITLE = `__e2e 经历 ${stamp}`;
const TMP_TAG = `__e2e_tag_${stamp}`;

async function main() {
  /* 1. 登录 */
  const loginRes = await login();
  const token = loginRes.json?.data?.accessToken;
  report('登录获取 JWT', !!token, token ? '' : JSON.stringify(loginRes.json).slice(0, 120));
  if (!token) return;

  /* 2. 公开列表 */
  const pub0 = await api('GET', '/timeline');
  const list0 = pub0.json?.data || [];
  report(
    'GET /timeline 公开列表（免登录）',
    pub0.status === 200 && list0.length >= 6,
    `count=${list0.length}`,
  );

  const desc = list0.every(
    (n, i) => i === 0 || list0[i - 1].startedAt >= n.startedAt,
  );
  report('公开列表按 startedAt 倒序', desc, desc ? '' : JSON.stringify(list0.map((n) => n.startedAt)));

  const seedCount = list0.length;

  /* 3. 管理列表 */
  const admin0 = await api('GET', '/timeline/admin/list', { token });
  report(
    'GET admin/list 返回全部经历（需 JWT）',
    admin0.status === 200 && (admin0.json?.data?.length ?? 0) >= seedCount,
    `count=${admin0.json?.data?.length}`,
  );

  /* 4. 候选标签 */
  const meta = await api('GET', '/timeline/admin/meta', { token });
  const tagCount = meta.json?.data?.tags?.length ?? -1;
  report(
    'GET admin/meta 返回候选标签',
    meta.status === 200 && tagCount >= 0,
    `tags=${tagCount}${tagCount > 0 ? ` · 例：${meta.json.data.tags.slice(0, 3).join('/')}` : ''}`,
  );

  /* 5. 新建（visible=false → 不进公开列表） */
  const created = await api('POST', '/timeline', {
    token,
    body: {
      kind: 'OPEN_SOURCE',
      title: TMP_TITLE,
      subTitle: 'e2e 临时条目',
      startedAt: '2026-09',
      endedAt: '2026-09',
      ongoing: false,
      description: 'e2e 验证用临时数据，脚本结束会删除。',
      tags: [TMP_TAG],
      visible: false,
    },
  });
  const nodeId = created.json?.data?.id;
  report(
    'POST /timeline 新建经历（visible=false）',
    [200, 201].includes(created.status) && !!nodeId,
    nodeId ? `id=${nodeId}` : JSON.stringify(created.json).slice(0, 140),
  );
  if (!nodeId) return;

  const pubHidden = await api('GET', '/timeline');
  const hiddenInPub = (pubHidden.json?.data || []).some((n) => n.id === nodeId);
  report('visible=false 的条目不出现在公开列表', !hiddenInPub);

  /* 6. 更新（visible=true + ongoing=true → endedAt 应被清空） */
  const updated = await api('PUT', `/timeline/${nodeId}`, {
    token,
    body: { visible: true, ongoing: true, endedAt: '2026-09' },
  });
  const d = updated.json?.data;
  report(
    'PUT /timeline/:id 更新成功',
    updated.status === 200 && d?.visible === true && d?.ongoing === true,
    d ? `visible=${d.visible}, ongoing=${d.ongoing}` : JSON.stringify(updated.json).slice(0, 140),
  );
  report('ongoing=true 时 endedAt 被强制清空', d?.endedAt === '', `endedAt="${d?.endedAt}"`);

  /* 7. 公开列表缓存已失效并能读到新条目 */
  const pub1 = await api('GET', '/timeline');
  const found = (pub1.json?.data || []).find((n) => n.id === nodeId);
  report(
    '公开列表缓存失效，新条目已可见',
    !!found && found.ongoing === true,
    found ? `title=${found.title}` : 'not found',
  );
  report(
    '列表长度 +1（缓存与 DB 一致）',
    (pub1.json?.data || []).length === seedCount + 1,
    `${seedCount} → ${(pub1.json?.data || []).length}`,
  );

  /* 8. 时间区间校验 */
  const badRange = await api('PUT', `/timeline/${nodeId}`, {
    token,
    body: { ongoing: false, startedAt: '2026-09', endedAt: '2025-01' },
  });
  report(
    '结束时间早于开始时间 → 8004 拒绝',
    badRange.json?.code === 8004,
    `code=${badRange.json?.code}, msg=${badRange.json?.message}`,
  );

  const badFormat = await api('PUT', `/timeline/${nodeId}`, {
    token,
    body: { startedAt: '2026/09' },
  });
  report(
    '开始时间格式非法 → 8004 拒绝',
    badFormat.json?.code === 8004,
    `code=${badFormat.json?.code}, msg=${badFormat.json?.message}`,
  );

  /* 9. 删除 + 清理 */
  const del = await api('DELETE', `/timeline/${nodeId}`, { token });
  report('DELETE /timeline/:id 删除成功', del.status === 200 && del.json?.code === 200, `code=${del.json?.code}`);

  const pub2 = await api('GET', '/timeline');
  const list2 = pub2.json?.data || [];
  report(
    '删除后公开列表恢复原始条数',
    list2.length === seedCount && !list2.some((n) => n.id === nodeId),
    `count=${list2.length}（期望 ${seedCount}）`,
  );

  const metaAfter = await api('GET', '/timeline/admin/meta', { token });
  const leaked = (metaAfter.json?.data?.tags || []).some((t) => t.startsWith('__e2e'));
  report('临时标签未残留（条目已删，标签随之消失）', !leaked);

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n=== 结果：${pass}/${results.length} 通过 ===`);
  process.exit(pass === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error('脚本异常：', e.message);
  process.exit(1);
});
