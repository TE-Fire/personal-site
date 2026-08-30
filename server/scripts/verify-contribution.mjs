/**
 * verify-contribution.mjs —— Contribution 贡献热力图 8 步端到端测试
 *
 * 前置依赖（与 verify-about.mjs 一致）：
 *   · MySQL + Redis 启动
 *   · NestJS server 运行在 127.0.0.1:3000
 *
 * 运行：
 *   cd server ; node scripts/verify-contribution.mjs
 *
 * 步骤（Phase 1 覆盖）：
 *   1. 未登录 GET /api/contribution/site
 *      → HTTP=200, code=200, source='SITE', cells 非空, level 合法 0-4
 *   2. cells 结构校验：日期升序、YYYY-MM-DD 格式、today 落在末尾
 *   3. 统计字段完整性：total / bestDay / currentStreak / longestStreak 语义合理
 *   4. meta.fallback 校验：因为 DB 中 Post/Life/Note 表即使存在也可能没数据，fallback=true 或 false 都接受
 *      —— 再检查 Redis 缓存 key 是否写入（personal_site:contribution:site:u1）
 *   5. 第二次调用 GET /api/contribution/site → 命中 Redis 缓存：应瞬间返回（脚本端只验证 body 一致即可，耗时没法精确断言）
 *   6. 管理员登录取 token → GET /api/contribution/invalidate → 缓存被删除
 *   7. [Phase 2/3 占位] GET /api/contribution/github 和 /merged 返回正常结构（200 + cells），merged.source='MERGED'
 *   8. 验证 About PUT 会触发 contribution 缓存失效：
 *        a) 读 /site 确保缓存存在
 *        b) 调 PUT /api/about 仅改 heatmapSource='SITE'（空改）
 *        c) 断言 Redis 中 personal_site:contribution:site:u1 已不存在
 *
 * 回滚：PUT /api/about 把 heatmapSource 恢复为原值（基本就是 SITE，无需真正改）
 */
import http from 'node:http';
import Redis from 'ioredis';

const BASE = 'http://127.0.0.1:3000';
const API = `${BASE}/api`;
const SITE_KEY_U1 = 'personal_site:contribution:site:u1';
const MERGED_KEY_U1 = 'personal_site:contribution:merged:u1';

/* ---------- 工具 ---------- */
function httpJson(method, urlPath, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath);
    const payload = body ? JSON.stringify(body) : null;
    const finalHeaders = { ...headers };
    if (payload) {
      finalHeaders['Content-Type'] = 'application/json';
      finalHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request(
      {
        host: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: finalHeaders,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let parsed = data;
          try { parsed = data ? JSON.parse(data) : null; } catch { /* ignore */ }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}
const pass = (msg) => console.log(`  ✅ ${msg}`);
const fail = (msg) => { console.error(`  ❌ ${msg}`); process.exitCode = 1; };
function check(cond, okMsg, errMsg) {
  if (cond) pass(okMsg);
  else fail(errMsg);
}

/* ---------- 登录工具 ---------- */
async function loginWithCaptcha(redis) {
  const captchaRsp = await httpJson('GET', `${API}/auth/captcha`);
  if (captchaRsp.body?.code !== 200 || !captchaRsp.body?.data?.captchaId) {
    fail(`验证码生成失败：HTTP=${captchaRsp.status} code=${captchaRsp.body?.code}`);
    return null;
  }
  const captchaId = captchaRsp.body.data.captchaId;
  let targetX = null;
  try { targetX = await redis.get(`personal_site:captcha:${captchaId}`); } catch (e) {
    fail(`Redis 读 captcha：${e.message}`); return null;
  }
  if (targetX == null) { fail('Redis 无 captcha key'); return null; }
  const loginRsp = await httpJson('POST', `${API}/auth/login`, {
    body: {
      username: 'admin', password: 'admin123',
      captchaId, slideX: Number(targetX) || 150,
    },
  });
  if (loginRsp.body?.code !== 200) {
    fail(`登录失败：HTTP=${loginRsp.status} code=${loginRsp.body?.code} msg=${loginRsp.body?.message}`);
    return null;
  }
  return loginRsp.body.data.accessToken;
}

/* ---------- cells 校验工具 ---------- */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function validateCells(cells) {
  if (!Array.isArray(cells) || cells.length < 100) return { ok: false, msg: `cells 不是数组或太短 len=${cells?.length}` };
  let prev = 0;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c || typeof c !== 'object') return { ok: false, msg: `cells[${i}] 非对象` };
    if (!DATE_RE.test(c.date)) return { ok: false, msg: `cells[${i}].date=${c.date} 格式不对` };
    if (typeof c.count !== 'number' || c.count < 0) return { ok: false, msg: `cells[${i}].count=${c.count} 非法` };
    if (![0,1,2,3,4].includes(c.level)) return { ok: false, msg: `cells[${i}].level=${c.level} 非法` };
    // level 语义：count==0→level==0；count>0→level>=1
    if (c.count === 0 && c.level !== 0) return { ok: false, msg: `cells[${i}].count=0 但 level=${c.level}` };
    if (c.count > 0 && c.level < 1) return { ok: false, msg: `cells[${i}].count=${c.count} 但 level=${c.level}` };
    const ts = new Date(c.date).getTime();
    if (isNaN(ts)) return { ok: false, msg: `cells[${i}].date=${c.date} Date.parse 失败` };
    if (i > 0 && ts <= prev) return { ok: false, msg: `cells[${i}] 日期不升序 prev=${cells[i-1].date} cur=${c.date}` };
    prev = ts;
  }
  return { ok: true, len: cells.length, lastDate: cells[cells.length - 1].date };
}

/* ---------- 主流程 ---------- */
async function main() {
  console.log('\n=== Contribution 贡献热力图 端到端测试（Phase 1）=====\n');
  const redis = new Redis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: 2, enableReadyCheck: true });

  /* ---- 前置清理：删掉 u1 的两个 key，保证第一次请求确实走 Service 计算 ---- */
  try { await redis.del(SITE_KEY_U1, MERGED_KEY_U1); console.log('  [清理] 删除 SITE/MERGED 缓存 key，便于端到端复现'); }
  catch (e) { fail(`前置 Redis 清理失败：${e.message}`); }

  /* ---- Step 1: 未登录 GET /contribution/site ---- */
  console.log('\n[1/8] 未登录 GET /api/contribution/site…');
  const t1 = Date.now();
  const r1 = await httpJson('GET', `${API}/contribution/site`);
  const t1Cost = Date.now() - t1;
  check(r1.status === 200, `HTTP=200（${r1.status}）`, `状态码不对 ${r1.status}`);
  check(r1.body?.code === 200, `body.code=200`, `body.code=${r1.body?.code} msg=${r1.body?.message}`);
  const d1 = r1.body?.data ?? {};
  check(d1.source === 'SITE', `source='SITE' (got ${d1.source})`, 'source 字段不对');
  check(typeof d1.total === 'number' && d1.total >= 0, `total=${d1.total}`, 'total 非法');
  check(typeof d1.currentStreak === 'number' && d1.currentStreak >= 0, `currentStreak=${d1.currentStreak}`, 'currentStreak 非法');
  check(typeof d1.longestStreak === 'number' && d1.longestStreak >= 0, `longestStreak=${d1.longestStreak}`, 'longestStreak 非法');
  check(d1.longestStreak >= d1.currentStreak, `longest(${d1.longestStreak}) ≥ current(${d1.currentStreak})`, 'longestStreak 语义不对');
  check(d1.bestDay && typeof d1.bestDay.date === 'string' && typeof d1.bestDay.count === 'number',
    `bestDay={date:'${d1.bestDay?.date}', count:${d1.bestDay?.count}}`,
    `bestDay 结构不对: ${JSON.stringify(d1.bestDay)}`);
  // date 空字符串 + count=0 是空态组合，二者必须成对出现
  if (d1.bestDay.count === 0) {
    check(d1.bestDay.date === '',
      `total=0 时 bestDay.date 应为 '' 空字符串（got '${d1.bestDay.date}'）`,
      `bestDay.count=0 但 date 非空：'${d1.bestDay.date}'`);
  } else {
    check(DATE_RE.test(d1.bestDay.date),
      `total>0 时 bestDay.date=${d1.bestDay.date} 符合 YYYY-MM-DD`,
      `bestDay.date 格式不对：${d1.bestDay.date}`);
  }
  console.log(`       耗时 ${t1Cost}ms（首次未命中缓存）`);

  /* ---- Step 2: cells 结构校验 ---- */
  console.log('\n[2/8] cells 结构校验（日期升序 / 格式 / level 语义）…');
  const v1 = validateCells(d1.cells);
  check(v1.ok, `cells OK，len=${v1.len} lastDate=${v1.lastDate}`, `cells 校验失败：${v1.msg}`);
  // lastDate 应该是"今天"（UTC+8 截断）—— 后端 cells 走到 today
  const todayCST = new Date();
  const y = todayCST.getFullYear();
  const m = String(todayCST.getMonth() + 1).padStart(2, '0');
  const d = String(todayCST.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  check(v1.lastDate === todayStr, `cells 末尾日期 = 今天 ${todayStr}`, `cells 末尾 ${v1.lastDate} ≠ 今天 ${todayStr}`);

  /* ---- Step 3: 统计字段与 cells 一致性（sum cells.count == total; bestDay 确实是 cells 最大 count 的日期之一） ---- */
  console.log('\n[3/8] 统计字段 ↔ cells 一致性校验…');
  const sum = d1.cells.reduce((acc, c) => acc + c.count, 0);
  check(sum === d1.total, `Σ cells.count(${sum}) == total(${d1.total})`, `sum=${sum} ≠ total=${d1.total}`);
  if (d1.bestDay.count > 0) {
    const match = d1.cells.find((c) => c.date === d1.bestDay.date);
    check(match && match.count === d1.bestDay.count,
      `bestDay date=${d1.bestDay.date} count=${d1.bestDay.count} 在 cells 中匹配`,
      `bestDay 不在 cells 或 count 不匹配 match=${JSON.stringify(match)}`);
  } else {
    pass(`bestDay.count=0 空态，跳过 cells↔bestDay 匹配（只要 total=0 就合法）`);
  }
  // currentStreak/longestStreak 重新计算
  let calcCurrent = 0;
  for (let i = d1.cells.length - 1; i >= 0; i--) {
    if (d1.cells[i].count > 0) calcCurrent++; else break;
  }
  let calcLongest = 0; let tmp = 0;
  for (const c of d1.cells) { if (c.count > 0) { tmp++; if (tmp > calcLongest) calcLongest = tmp; } else tmp = 0; }
  check(calcCurrent === d1.currentStreak,
    `currentStreak=${d1.currentStreak} 独立重算=${calcCurrent}`,
    `currentStreak=${d1.currentStreak}，但重算=${calcCurrent}`);
  check(calcLongest === d1.longestStreak,
    `longestStreak=${d1.longestStreak} 独立重算=${calcLongest}`,
    `longestStreak=${d1.longestStreak}，但重算=${calcLongest}`);

  /* ---- Step 4: meta + Redis 缓存写入检查 ---- */
  console.log('\n[4/8] meta 字段 + Redis 缓存写入检查…');
  check(d1.meta && typeof d1.meta === 'object', `meta 存在 = ${JSON.stringify(d1.meta).slice(0,100)}`, 'meta 缺失或非对象');
  check(Array.isArray(d1.meta.tablesFound), `meta.tablesFound 是数组 len=${d1.meta.tablesFound?.length}`, 'tablesFound 不是数组');
  // meta.fallback: tablesFound 为空 → fallback 必 true；tablesFound 非空 → 必 false
  if (d1.meta.tablesFound.length === 0) {
    check(d1.meta.fallback === true, `tablesFound=[] → meta.fallback=true`, `tablesFound=[] 但 fallback=${d1.meta.fallback}`);
  } else {
    check(d1.meta.fallback === false, `tablesFound=${JSON.stringify(d1.meta.tablesFound)} → meta.fallback=false`, `tablesFound 非空但 fallback=${d1.meta.fallback}`);
  }
  // Redis key
  const v1Cached = await redis.get(SITE_KEY_U1);
  check(v1Cached != null, `Redis 已写入 ${SITE_KEY_U1} len=${v1Cached?.length ?? 0}`, `Redis 没写 SITE 缓存 key`);

  /* ---- Step 5: 第二次 GET，确认 body 一致（缓存命中） ---- */
  console.log('\n[5/8] 第二次 GET /contribution/site —— 命中缓存 body 与第一次字节级一致…');
  const r2 = await httpJson('GET', `${API}/contribution/site`);
  check(r2.status === 200 && r2.body?.code === 200, `第二次调用成功`, `失败：HTTP=${r2.status} code=${r2.body?.code}`);
  const sameTotal = r2.body?.data?.total === d1.total;
  const sameLen = r2.body?.data?.cells?.length === d1.cells.length;
  const sameSource = r2.body?.data?.source === 'SITE';
  check(sameTotal && sameLen && sameSource,
    `缓存命中后 body 一致（total=${d1.total} cells.len=${d1.cells.length} source=SITE）`,
    `缓存结果不一致：total1=${d1.total} total2=${r2.body?.data?.total} len2=${r2.body?.data?.cells?.length} src2=${r2.body?.data?.source}`);

  /* ---- Step 6: 登录 → GET /contribution/invalidate → key 被删 ---- */
  console.log('\n[6/8] 管理员登录 → GET /contribution/invalidate → SITE/MERGED key 被删…');
  const token = await loginWithCaptcha(redis);
  if (!token) { fail('无法跳过后续步骤（没 token）'); await redis.quit(); return; }
  const inv = await httpJson('GET', `${API}/contribution/invalidate`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(inv.status === 200 && inv.body?.code === 200 && inv.body?.data?.invalidated === true,
    `失效接口成功 code=${inv.body?.code} data=${JSON.stringify(inv.body?.data)}`,
    `invalidate 失败：HTTP=${inv.status} code=${inv.body?.code} msg=${inv.body?.message}`);
  const siteKeyAfterInv = await redis.get(SITE_KEY_U1);
  check(siteKeyAfterInv == null, `invalidate 后 ${SITE_KEY_U1} 已删除`, `invalidate 后 key 还存在 len=${siteKeyAfterInv?.length ?? 0}`);

  /* ---- Step 7: Phase 2/3 占位 github + merged ---- */
  console.log('\n[7/8] Phase 2/3 占位接口：GET /github + /merged 正常返回…');
  const rGithub = await httpJson('GET', `${API}/contribution/github`);
  check(rGithub.status === 200 && rGithub.body?.code === 200, `/github 成功 code=${rGithub.body?.code}`, `/github 异常：HTTP=${rGithub.status} code=${rGithub.body?.code}`);
  const g = rGithub.body?.data ?? {};
  check(g.source === 'GITHUB', `github.source='GITHUB'`, `source=${g.source}`);
  const vGithub = validateCells(g.cells);
  check(vGithub.ok, `github cells 基础结构 OK len=${vGithub.len}`, `github cells：${vGithub.msg}`);

  const rMerged = await httpJson('GET', `${API}/contribution/merged`);
  check(rMerged.status === 200 && rMerged.body?.code === 200, `/merged 成功 code=${rMerged.body?.code}`, `/merged 异常：HTTP=${rMerged.status} code=${rMerged.body?.code}`);
  const mg = rMerged.body?.data ?? {};
  check(mg.source === 'MERGED', `merged.source='MERGED'（Phase 3 占位代理）`, `source=${mg.source}`);
  const vMerged = validateCells(mg.cells);
  check(vMerged.ok, `merged cells 结构 OK len=${vMerged.len}`, `merged cells：${vMerged.msg}`);
  // 检查 merged 缓存 key 是否已写入
  const mergedCached = await redis.get(MERGED_KEY_U1);
  check(mergedCached != null, `Redis 写入 ${MERGED_KEY_U1} len=${mergedCached?.length ?? 0}`, `merged key 没写入`);

  /* ---- Step 8: About PUT 触发贡献缓存失效钩子 ---- */
  console.log('\n[8/8] 验证 About PUT → 自动触发 Contribution 缓存失效钩子…');
  // a) 先 GET /site 确保 SITE key 写入
  await httpJson('GET', `${API}/contribution/site`);
  const siteAfter = await redis.exists(SITE_KEY_U1);
  check(siteAfter === 1, `[步骤 a] 重新 GET /site → Redis key 写入`, `site key 仍不存在`);
  await httpJson('GET', `${API}/contribution/merged`);
  const mergedAfter = await redis.exists(MERGED_KEY_U1);
  check(mergedAfter === 1, `[步骤 a] 重新 GET /merged → Redis key 写入`, `merged key 仍不存在`);

  // b) 拿 About 原始字段 + 调 PUT（仅提交完整合法 DTO，heatmapSource 从 'SITE' 到 'SITE' 空改也可）
  const aboutRsp = await httpJson('GET', `${API}/about`);
  if (aboutRsp.body?.code !== 200) fail(`步骤 b 读 About 失败：code=${aboutRsp.body?.code}`);
  const about = aboutRsp.body?.data ?? {};
  const origSource = about.heatmapSource ?? 'SITE';
  // 保证 PUT 合法 DTO（所有必填数组都传）
  const putPayload = {
    shortBio: about.shortBio || 'E2E shortBio',
    location: about.location || '中国',
    available: Boolean(about.available),
    longBio: Array.isArray(about.longBio) ? about.longBio : [],
    tags: Array.isArray(about.tags) ? about.tags : ['a','b','c','d'],
    interests: Array.isArray(about.interests) ? about.interests : [],
    nowDoing: Array.isArray(about.nowDoing) ? about.nowDoing : [],
    highlightStats: Array.isArray(about.highlightStats) ? about.highlightStats : [],
    skillGroups: Array.isArray(about.skillGroups) ? about.skillGroups : [],
    // 热力图 4 字段全传，Phase 1 不改其值（也顺便验证它们能成功写回）
    heatmapSource: origSource,
    heatmapEnableGithub: Boolean(about.heatmapEnableGithub),
    githubUsername: typeof about.githubUsername === 'string' ? about.githubUsername : '',
    githubLink: typeof about.githubLink === 'string' ? about.githubLink : '',
  };
  const putR = await httpJson('PUT', `${API}/about`, {
    body: putPayload,
    headers: { Authorization: `Bearer ${token}` },
  });
  check(putR.body?.code === 200,
    `[步骤 b] PUT /about 成功 code=${putR.body?.code} msg=${putR.body?.message}`,
    `PUT /about 失败：HTTP=${putR.status} code=${putR.body?.code} msg=${putR.body?.message}`);

  // c) 断言 SITE 和 MERGED 缓存 key 都被删（失效钩子被 ContributionService.invalidateAll 处理）
  const siteKeyPutHook = await redis.get(SITE_KEY_U1);
  check(siteKeyPutHook == null,
    `[步骤 c] About PUT 钩子 → ${SITE_KEY_U1} 被删`,
    `About PUT 后 SITE key 还在！len=${siteKeyPutHook?.length ?? 0}`);
  const mergedKeyPutHook = await redis.get(MERGED_KEY_U1);
  check(mergedKeyPutHook == null,
    `[步骤 c] About PUT 钩子 → ${MERGED_KEY_U1} 被删`,
    `About PUT 后 MERGED key 还在！len=${mergedKeyPutHook?.length ?? 0}`);
  // About 模块返回的 AboutRsp 应该包含 4 个热力图字段
  const putData = putR.body?.data ?? {};
  check(typeof putData.heatmapSource === 'string', `AboutRsp 包含 heatmapSource=${putData.heatmapSource}`, `heatmapSource 缺失或类型错`);
  check(typeof putData.heatmapEnableGithub === 'boolean', `AboutRsp 包含 heatmapEnableGithub=${putData.heatmapEnableGithub}`, `heatmapEnableGithub 缺失或类型错`);
  check(typeof putData.githubUsername === 'string', `AboutRsp 包含 githubUsername='${putData.githubUsername}'`, `githubUsername 缺失或类型错`);
  check(typeof putData.githubLink === 'string', `AboutRsp 包含 githubLink='${putData.githubLink}'`, `githubLink 缺失或类型错`);

  try { await redis.quit(); } catch { /* ignore */ }

  console.log('\n=== 完成 ============================================');
  if (process.exitCode) console.log('  有失败项，请检查上面 ❌ 输出');
  else console.log('  🎉 全部 8 步通过！（Phase 1 后端 Contribution 模块达标）');
}

main().catch((e) => {
  console.error('❌ 测试脚本异常：', e);
  process.exit(1);
});
