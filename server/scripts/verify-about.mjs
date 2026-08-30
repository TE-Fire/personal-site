/**
 * verify-about.js —— About 模块 6 步端到端测试（需要：MySQL + Redis 启动，server 运行端口 3000）
 *
 * 运行：
 *   cd server ; node scripts/verify-about.mjs
 *
 * 步骤：
 *   1. 未登录 GET /api/about → 应 200 + 返回完整 AboutRsp（10 字段 + 数组非空）
 *   2. 检查响应头 Cache-Control: public, max-age=60
 *   3. 滑块验证码 → 登录拿 Token
 *   4. PUT /api/about 修改 shortBio/location/tags → 200，返回修改后对象
 *   5. 未登录再 GET /api/about → 新值立即反映（即使 Cache-Control 60，因为 admin PUT 已删 Redis）
 *   6. 非法 DTO（tags 数组 5 项超过上限 4）→ 400 VALIDATION_FAILED
 *   7. 验证 Redis 里 personal_site:about:public 存在（第 1 步写入）
 *   8. 回滚：PUT 恢复原始字段值
 */
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';

const BASE = 'http://127.0.0.1:3000';
const API = `${BASE}/api`;

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

/* ---------- 主流程 ---------- */
async function main() {
  console.log('\n=== About 模块端到端测试 ==========\n');

  /* ---- 第 1 步：未登录 GET /about ---- */
  console.log('[1/8] 未登录 GET /api/about…');
  const get1 = await httpJson('GET', `${API}/about`);
  check(get1.status === 200, `HTTP 200（got ${get1.status}）`, `状态码不对：${get1.status}`);
  check(get1.body?.code === 200, `Result.code=200`, `Result.code=${get1.body?.code}, msg=${get1.body?.message}`);
  const rsp1 = get1.body?.data || {};
  check(typeof rsp1.name === 'string' && rsp1.name.length > 0, `name=${rsp1.name}`, 'name 空');
  check(typeof rsp1.shortBio === 'string' && rsp1.shortBio.length > 50, `shortBio 长度${rsp1.shortBio?.length}`, 'shortBio 空');
  check(Array.isArray(rsp1.longBio) && rsp1.longBio.length >= 3, `longBio 段数=${rsp1.longBio?.length}`, 'longBio 至少 3 段');
  check(Array.isArray(rsp1.highlightStats) && rsp1.highlightStats.length === 4, `highlightStats 项数=${rsp1.highlightStats?.length}`, '应为 4 项');
  check(Array.isArray(rsp1.skillGroups) && rsp1.skillGroups.length >= 3, `skillGroups 组数=${rsp1.skillGroups?.length}`, '至少 3 组');
  check(Array.isArray(rsp1.tags) && rsp1.tags.length === 4, `tags 项数=${rsp1.tags?.length}`, '应为 4 项');
  check(Array.isArray(rsp1.interests) && rsp1.interests.length >= 6, `interests 项数=${rsp1.interests?.length}`, '至少 6 项');
  check(Array.isArray(rsp1.nowDoing) && rsp1.nowDoing.length === 4, `nowDoing 项数=${rsp1.nowDoing?.length}`, '应为 4 项');
  check(typeof rsp1.location === 'string' && rsp1.location.includes('中国'), `location=${rsp1.location}`, 'location 应包含 中国');
  check(rsp1.available === true, `available=${rsp1.available}`, '应为 true');
  // skillGroups 内部结构校验
  const g0 = rsp1.skillGroups?.[0];
  check(g0 && typeof g0.id === 'string' && Array.isArray(g0.items), `skillGroup[0] = {id:${g0?.id}, title:${g0?.title}, items.len=${g0?.items?.length}}`, 'skillGroup[0] 结构不对');

  /* ---- 第 2 步：Cache-Control ---- */
  console.log('\n[2/8] 检查响应头 Cache-Control…');
  const cc = get1.headers?.['cache-control'] || '';
  check(cc.includes('public') && cc.includes('max-age=60'), `Cache-Control: ${cc}`, '应为 public, max-age=60');

  /* ---- 第 3 步：登录拿 token ---- */
  console.log('\n[3/8] 滑块验证码 → 登录…');
  const captchaRsp = await httpJson('GET', `${API}/auth/captcha`);
  check(captchaRsp.body?.code === 200 && captchaRsp.body?.data?.captchaId, '验证码生成成功', `拿不到 captchaId: HTTP=${captchaRsp.status} code=${captchaRsp.body?.code}`);
  const captchaId = captchaRsp.body.data.captchaId;
  // 读 Redis 取 targetX
  const redis = new Redis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: 2, enableReadyCheck: true });
  let targetX = null;
  try {
    targetX = await redis.get(`personal_site:captcha:${captchaId}`);
  } catch (e) {
    fail(`Redis 读 captcha 失败：${e.message}`);
  }
  check(targetX != null, `从 Redis 拿到 targetX=${targetX}`, `Redis 没找到 captchaId`);

  const loginRsp = await httpJson('POST', `${API}/auth/login`, {
    body: {
      username: 'admin',
      password: 'admin123',
      captchaId,
      slideX: Number(targetX) || 150,
    },
  });
  // 统一契约：看 body.code（不是 HTTP status —— NestJS POST 可能 201 Created）
  check(loginRsp.body?.code === 200, `登录成功 code=${loginRsp.body?.code} msg=${loginRsp.body?.message}`, `登录失败：HTTP=${loginRsp.status} code=${loginRsp.body?.code} msg=${loginRsp.body?.message}`);
  const token = loginRsp.body?.data?.accessToken;
  check(token && token.length > 10, `拿到 accessToken len=${token?.length}`, 'token 空');

  /* ---- 第 7 步提前跑：Redis About key ---- */
  console.log('\n[*] 检查 Redis About 缓存 key…');
  try {
    const exists = await redis.exists('personal_site:about:public');
    if (exists === 1) pass('Redis key personal_site:about:public 已写入（第 1 步 GET 写入）');
    else fail('Redis key personal_site:about:public 不存在（GET 路径缓存写入有问题？）');
  } catch (e) {
    fail(`Redis check 失败：${e.message}`);
  }

  /* ---- 第 4 步：PUT 修改 ---- */
  console.log('\n[4/8] 管理员 PUT /api/about 修改 3 个字段…');
  const NEW_SHORT = 'E2E 测试短简介：修改时间 ' + new Date().toISOString();
  const NEW_LOC = 'Mars · 红色星球（UTC+9，测试值）';
  const NEW_TAGS = ['测试标签 A', '测试标签 B', '测试标签 C', '测试标签 D']; // 严格 4 项
  const putRsp = await httpJson('PUT', `${API}/about`, {
    body: {
      shortBio: NEW_SHORT,
      location: NEW_LOC,
      available: false,
      tags: NEW_TAGS,
      longBio: rsp1.longBio,
      interests: rsp1.interests,
      nowDoing: rsp1.nowDoing,
      highlightStats: rsp1.highlightStats,
      skillGroups: rsp1.skillGroups,
    },
    headers: { Authorization: `Bearer ${token}` },
  });
  check(putRsp.body?.code === 200, `PUT 成功 code=${putRsp.body?.code}, msg=${putRsp.body?.message}`, `PUT 失败：HTTP=${putRsp.status} code=${putRsp.body?.code} / ${putRsp.body?.message}`);
  const putData = putRsp.body?.data || {};
  check(putData.shortBio === NEW_SHORT, `PUT 返回 shortBio 已更新`, `返回 shortBio=${putData.shortBio?.slice?.(0, 30)}… 不匹配`);
  check(putData.location === NEW_LOC, `PUT 返回 location 已更新`, `返回 location=${putData.location}`);
  check(putData.available === false, `PUT 返回 available=false`, `返回 available=${putData.available}`);
  check(JSON.stringify(putData.tags) === JSON.stringify(NEW_TAGS), `PUT 返回 tags 4 项更新成功`, `tags=${JSON.stringify(putData.tags)}`);

  /* ---- 第 5 步：验证 PUT 后 公开 GET 立即反映新值 ---- */
  console.log('\n[5/8] 未登录 GET /api/about —— 应立即看到新值（admin PUT 删了 Redis 缓存）…');
  const get2 = await httpJson('GET', `${API}/about`);
  check(get2.status === 200 && get2.body?.code === 200, `GET again code=${get2.body?.code}`, 'get2 失败');
  const rsp2 = get2.body?.data || {};
  check(rsp2.shortBio === NEW_SHORT, `shortBio 立即反映（${rsp2.shortBio?.slice?.(0, 30)}…）`, '缓存没失效，短简介仍是旧值');
  check(rsp2.location === NEW_LOC, `location 立即反映（${rsp2.location}）`, 'location 未更新');
  check(rsp2.available === false, `available 立即反映 false`, `available=${rsp2.available}`);

  /* ---- 第 6 步：非法 DTO 校验 ---- */
  console.log('\n[6/8] 非法 DTO（tags=5 项，超过 maxSize 4）应返回 400 校验失败…');
  const bad = await httpJson('PUT', `${API}/about`, {
    body: {
      shortBio: NEW_SHORT,
      location: NEW_LOC,
      available: true,
      tags: ['a','b','c','d','e'], // 5 项 —— 上限 4
      longBio: [], interests: [], nowDoing: [],
      highlightStats: [], skillGroups: [],
    },
    headers: { Authorization: `Bearer ${token}` },
  });
  check(bad.status === 400 || (bad.status === 200 && bad.body?.code >= 400),
    `非法 DTO → HTTP=${bad.status} body.code=${bad.body?.code}`,
    `没拦住：HTTP=${bad.status} code=${bad.body?.code}`);

  /* ---- 第 8 步：回滚 ---- */
  console.log('\n[8/8] 回滚：恢复原始 shortBio/location/available/tags…');
  const rollback = await httpJson('PUT', `${API}/about`, {
    body: {
      shortBio: '一个热爱构建的前端工程师，专注 Vue 3 / TypeScript / Tailwind / AI 辅助开发工作流。喜欢把「设计感」和「工程化」拧在一起，也喜欢在长期开源项目里一点点打磨细节。',
      location: '中国 · 远程协作友好（UTC+8）',
      available: true,
      tags: ['Vue 3 生态', 'TypeScript 工程化', '设计系统与 UI 质感', 'AI Agent 工作流'],
      longBio: rsp1.longBio,
      interests: rsp1.interests,
      nowDoing: rsp1.nowDoing,
      highlightStats: rsp1.highlightStats,
      skillGroups: rsp1.skillGroups,
    },
    headers: { Authorization: `Bearer ${token}` },
  });
  check(rollback.body?.code === 200,
    `回滚 PUT 成功 code=${rollback.body?.code} msg=${rollback.body?.message}`,
    `回滚失败：HTTP=${rollback.status} code=${rollback.body?.code} msg=${rollback.body?.message}`);
  const restored = rollback.body?.data || {};
  check(restored.available === true && restored.tags.length === 4,
    `回滚完 available=true tags.len=4`,
    `available=${restored.available} tags=${JSON.stringify(restored.tags)}`);

  try { await redis.quit(); } catch { /* ignore */ }

  console.log('\n=== 完成 ===========================');
  if (process.exitCode) console.log('  有失败项，请检查上面 ❌ 输出');
  else console.log('  🎉 全部 8 步通过！');
}

main().catch((e) => {
  console.error('❌ 测试脚本异常：', e);
  process.exit(1);
});
