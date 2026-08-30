/**
 * Phase 2 · Contribution 模块（GitHub + MERGED）端到端测试（8 步 + 回滚）。
 *
 * 复用 verify-about.mjs 的 node:http + ioredis 风格，避免 node fetch + ioredis
 * 在 Windows Node 24 下触发 UV_HANDLE_CLOSING 断言崩溃。
 */
import http from 'node:http';
import Redis from 'ioredis';

const HOST = '127.0.0.1';
const PORT = 3000;
const API = '/api';
const GITHUB_USER = 'TE-Fire';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
          let parsed = data ? null : null;
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

/* ---------------- 登录（滑块验证码 → Redis 读 targetX）---------------- */
async function login(redis) {
  console.log('\n[前置 0] 滑块验证码 + 登录拿 Token');
  const cap = await httpJson('GET', `${API}/auth/captcha`);
  if (cap.body?.code !== 200 || !cap.body?.data?.captchaId) {
    fail('0.0 验证码获取成功', `HTTP=${cap.status} code=${cap.body?.code}`);
  }
  const captchaId = cap.body.data.captchaId;
  let targetX = null;
  try {
    targetX = await redis.get(`personal_site:captcha:${captchaId}`);
  } catch (e) {
    fail('0.1 Redis 读取 captcha key', e.message);
  }
  if (targetX == null) fail('0.2 Redis captcha key 有值', 'key 不存在');
  const loginR = await httpJson('POST', `${API}/auth/login`, {
    body: {
      username: 'admin',
      password: 'admin123',
      captchaId,
      slideX: Number(targetX) || 150,
    },
  });
  if (loginR.body?.code !== 200) {
    fail('0.3 登录成功 code=200', `code=${loginR.body?.code} msg=${loginR.body?.message}`);
  }
  const token = loginR.body?.data?.accessToken;
  if (!token) fail('0.4 accessToken 非空');
  ok('前置 0 滑块 + 登录', `token len=${token.length}`);
  return token;
}

async function fetchAbout(token) {
  const r = await httpJson('GET', `${API}/about`, { token });
  if (r.body?.code !== 200) throw new Error('GET /about 失败：' + JSON.stringify(r.body));
  return r.body.data;
}

async function putAbout(token, overrides) {
  const cur = await fetchAbout(token);
  const body = {
    shortBio: cur.shortBio,
    location: cur.location,
    available: cur.available,
    longBio: cur.longBio,
    tags: cur.tags,
    interests: cur.interests,
    nowDoing: cur.nowDoing,
    highlightStats: cur.highlightStats,
    skillGroups: cur.skillGroups,
    heatmapSource: overrides.heatmapSource ?? cur.heatmapSource,
    heatmapEnableGithub: overrides.heatmapEnableGithub ?? cur.heatmapEnableGithub,
    githubUsername: overrides.githubUsername ?? cur.githubUsername ?? '',
    githubLink: overrides.githubLink ?? cur.githubLink ?? '',
  };
  const r = await httpJson('PUT', `${API}/about`, { token, body });
  if (r.body?.code !== 200) throw new Error('PUT /about 失败：' + JSON.stringify(r.body));
  return r.body.data;
}

async function main() {
  const redis = new Redis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: 2, enableReadyCheck: true });
  try {
    console.log('🏁 Phase 2 · Contribution（GitHub + MERGED）端到端测试开始');
    const snapshot = { about: null, githubKeyExists: null, token: null };

    // ---------- 前置 0 登录 + 快照 ----------
    snapshot.token = await login(redis);
    snapshot.about = {
      heatmapSource: null, heatmapEnableGithub: null, githubUsername: null, githubLink: null,
    };
    {
      const a = await fetchAbout(snapshot.token);
      snapshot.about = {
        heatmapSource: a.heatmapSource,
        heatmapEnableGithub: a.heatmapEnableGithub,
        githubUsername: a.githubUsername,
        githubLink: a.githubLink,
      };
      console.log('  ⏮  About 原值：', JSON.stringify(snapshot.about));
      const gKey = `personal_site:contribution:github:${GITHUB_USER}`;
      snapshot.githubKeyExists = await redis.exists(gKey);
      ok('前置 0 快照完成', `github 原 key exists=${snapshot.githubKeyExists}`);
    }

    // ---------- Step 1 enable=false → /github 立即 fallback 空 ----------
    console.log('\n[Step 1] enableGitHub=false → /github 立即 fallback 空态');
    {
      await putAbout(snapshot.token, { heatmapEnableGithub: false });
      const r = await httpJson('GET', `${API}/contribution/github`);
      const d = r.body?.data;
      if (r.body?.code !== 200) fail('1.0 HTTP=200', `code=${r.body?.code}`);
      if (d.total !== 0) fail('1.1 total=0', `total=${d.total}`);
      const tables = d.meta?.tablesFound ?? [];
      if (!tables.includes('github_disabled')) fail('1.2 tables=github_disabled', JSON.stringify(tables));
      if (d.source !== 'GITHUB') fail('1.3 source=GITHUB', `source=${d.source}`);
      if (!Array.isArray(d.cells) || d.cells.length < 300) fail('1.4 cells≥300（完整网格占位）', `len=${d.cells?.length}`);
      ok('Step 1 禁用 → /github fallback 空态');
    }

    // ---------- Step 2 PUT enable=true source=MERGED ----------
    console.log('\n[Step 2] PUT → enableGitHub=true + heatmapSource=MERGED + githubUsername=TE-Fire');
    {
      const d = await putAbout(snapshot.token, {
        heatmapEnableGithub: true,
        heatmapSource: 'MERGED',
        githubUsername: GITHUB_USER,
        githubLink: `https://github.com/${GITHUB_USER}`,
      });
      if (d.heatmapEnableGithub !== true) fail('2.1 enable=true', `实际=${d.heatmapEnableGithub}`);
      if (d.heatmapSource !== 'MERGED') fail('2.2 source=MERGED', `实际=${d.heatmapSource}`);
      if ((d.githubUsername || '').trim() !== GITHUB_USER) fail('2.3 username=TE-Fire', `实际=${d.githubUsername}`);
      if (!(d.githubLink || '').includes(GITHUB_USER)) fail('2.4 githubLink 正确', `实际=${d.githubLink}`);
      ok('Step 2 PUT About 修改 4 字段');
    }

    // ---------- Step 3 SITE 空态 ----------
    console.log('\n[Step 3] GET /contribution/site → 空态 fallback');
    {
      const r = await httpJson('GET', `${API}/contribution/site`);
      const d = r.body?.data;
      if (r.body?.code !== 200) fail('3.0 HTTP=200');
      if (d.source !== 'SITE') fail('3.1 source=SITE', `actual=${d.source}`);
      if (d.total !== 0) fail('3.2 total=0（post 表无发布）', `actual=${d.total}`);
      if (d.meta?.fallback !== true) fail('3.3 fallback=true', `actual=${d.meta?.fallback}`);
      ok('Step 3 SITE 空态');
    }

    // ---------- Step 4 GitHub 真实贡献断言 ----------
    console.log('\n[Step 4] GET /contribution/github → TE-Fire 真实贡献 ≥500');
    {
      const r = await httpJson('GET', `${API}/contribution/github`);
      if (r.body?.code !== 200) fail('4.0 HTTP=200', `status=${r.status} code=${r.body?.code}`);
      const d = r.body.data;
      if (d.source !== 'GITHUB') fail('4.1 source=GITHUB', `actual=${d.source}`);
      if (!(d.total >= 500)) fail('4.2 total≥500', `actual total=${d.total}`);
      const cells = d.cells ?? [];
      if (cells.length < 350 || cells.length > 380) fail('4.3 cells.len=365±15', `actual=${cells.length}`);
      if (d.meta?.githubFailed) fail('4.4 githubFailed=false', `actual=${d.meta?.githubFailed}`);
      const tables = d.meta?.tablesFound ?? [];
      if (!tables.includes('github_graphql')) fail('4.5 tables=github_graphql', JSON.stringify(tables));
      if (!d.bestDay || d.bestDay.count <= 0) fail('4.6 bestDay.count>0', JSON.stringify(d.bestDay));
      if (d.bestDay.date && !DATE_RE.test(d.bestDay.date)) fail('4.7 bestDay.date 格式', d.bestDay.date);
      if (d.longestStreak < d.currentStreak) fail('4.8 longest≥current', `${d.longestStreak}<${d.currentStreak}`);
      ok('Step 4 GitHub 真实贡献', `total=${d.total}, longest=${d.longestStreak}, best=${d.bestDay.date}#${d.bestDay.count}`);
    }

    // ---------- Step 5 Redis GitHub 缓存 ----------
    console.log('\n[Step 5] Redis GitHub key 已写入 & TTL>3600s');
    {
      const k = `personal_site:contribution:github:${GITHUB_USER}`;
      const e = await redis.exists(k);
      if (e !== 1) fail('5.0 key 存在', `exists=${e}`);
      const v = await redis.get(k);
      if (!v) fail('5.1 value 非空');
      try { JSON.parse(v); } catch (err) { fail('5.2 JSON.parse', String(err).slice(0, 200)); }
      const ttl = await redis.ttl(k);
      if (!(ttl > 3600)) fail('5.3 ttl>3600s（24h TTL）', `ttl=${ttl}`);
      ok('Step 5 Redis GitHub 缓存 OK', `ttl≈${Math.round(ttl / 3600)}h`);
    }

    // ---------- Step 6 MERGED 合并视图 ----------
    console.log('\n[Step 6] GET /contribution/merged → merged.total ≥ max(site, github)');
    {
      const [sr, gr, mr] = await Promise.all([
        httpJson('GET', `${API}/contribution/site`),
        httpJson('GET', `${API}/contribution/github`),
        httpJson('GET', `${API}/contribution/merged`),
      ]);
      const sT = sr.body?.data?.total ?? 0;
      const gT = gr.body?.data?.total ?? 0;
      const mT = mr.body?.data?.total ?? 0;
      const mD = mr.body?.data;
      if (mr.body?.code !== 200) fail('6.0 merged HTTP=200', `actual=${mr.status}`);
      if (mD?.source !== 'MERGED') fail('6.1 source=MERGED', `actual=${mD?.source}`);
      const max = Math.max(sT, gT);
      if (mT < max) fail(`6.2 merged.total(${mT}) ≥ max(site=${sT},github=${gT})=${max}`);
      ok('Step 6 MERGED 合并 OK', `site=${sT} + github=${gT} → merged=${mT}, mergedFallback=${mD.meta?.mergedFallback ?? 'none'}`);
    }

    // ---------- Step 7 关闭开关 → 立即降级 ----------
    console.log('\n[Step 7] enable=false → /github fallback + /merged mergedFallback=github');
    {
      await putAbout(snapshot.token, { heatmapEnableGithub: false, githubUsername: GITHUB_USER });
      await httpJson('GET', `${API}/contribution/invalidate`, { token: snapshot.token });
      const gh = await httpJson('GET', `${API}/contribution/github`);
      if (gh.body?.data?.total !== 0) fail('7.0 /github total=0', `actual=${gh.body?.data?.total}`);
      const tables = gh.body?.data?.meta?.tablesFound ?? [];
      if (!tables.includes('github_disabled')) fail('7.1 tables=github_disabled', JSON.stringify(tables));
      const mg = await httpJson('GET', `${API}/contribution/merged`);
      ok('Step 7 开关关闭后降级生效', `merged.total=${mg.body?.data?.total}, mergedFallback=${mg.body?.data?.meta?.mergedFallback ?? 'none'}`);
    }

    // ---------- Step 8 回滚 ----------
    console.log('\n[Step 8] 回滚 About 原值 + invalidate → Redis key 清理');
    {
      const rolled = await putAbout(snapshot.token, {
        heatmapSource: snapshot.about.heatmapSource,
        heatmapEnableGithub: snapshot.about.heatmapEnableGithub,
        githubUsername: snapshot.about.githubUsername,
        githubLink: snapshot.about.githubLink,
      });
      ok('8.0 PUT 回滚成功', `enableGithub=${rolled.heatmapEnableGithub}, source=${rolled.heatmapSource}`);
      const inv = await httpJson('GET', `${API}/contribution/invalidate`, { token: snapshot.token });
      if (inv.body?.code !== 200) fail('8.1 invalidate 成功', JSON.stringify(inv.body));
      ok('8.1 /contribution/invalidate 返回 ok');
      const k = `personal_site:contribution:github:${GITHUB_USER}`;
      const nowE = await redis.exists(k);
      if (snapshot.githubKeyExists === 0 && nowE === 1) {
        fail('8.2 GitHub key 清理（快照=0→现应=0）', `now exists=${nowE}`);
      }
      ok('8.2 Redis GitHub key 清理 OK', `orig_exists=${snapshot.githubKeyExists}, now_exists=${nowE}`);
    }

    console.log(`\n🏆 [${pass}/${total}] Phase 2 后端 Contribution 端到端全部通过 ✅`);
  } finally {
    try { await redis.quit(); } catch { /* ignore */ }
  }
}

main().catch((e) => {
  console.error('\n💥 测试异常中断：', e?.stack ?? e);
  process.exit(1);
});
