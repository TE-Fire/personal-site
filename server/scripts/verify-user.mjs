/**
 * verify-user.mjs —— User 模块端到端测试（MySQL + Redis + server:3000）
 *
 * 运行：
 *   cd server ; node scripts/verify-user.mjs
 *
 * 步骤：
 *   1. 未登录 GET /api/users/me → 应 401（JWT 守卫拦截）
 *   2. 滑块验证码 → 登录拿 admin Token
 *   3. 登录 GET /api/users/me → 200，返回完整 UserProfileRsp（id/username/nickname/email/avatar/role）
 *   4. POST /api/users/me 修改 nickname/email → 200，更新后对象返回
 *   5. POST /api/users/avatar 上传小 JPG → 200，返回 avatar URL
 *   6. 访问 avatar 静态资源 URL → 200 可访问
 *   7. DELETE /api/users/avatar 清除头像 → 200，avatar 为空
 *   8. 回滚：恢复原邮箱、恢复原头像
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import Redis from 'ioredis';

const BASE = 'http://127.0.0.1:3000';
const API = `${BASE}/api`;

/* ---------- 工具：JSON HTTP ---------- */
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
      { host: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: finalHeaders },
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

/* ---------- 工具：multipart 上传（头像）---------- */
function httpUpload(urlPath, fieldName, fileName, fileBytes, { headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath);
    const boundary = '----UserE2EBoundary' + Date.now();
    const CRLF = '\r\n';
    const pre = Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"${CRLF}` +
      `Content-Type: image/jpeg${CRLF}${CRLF}`
    );
    const post = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
    const totalLen = pre.length + fileBytes.length + post.length;
    const finalHeaders = {
      ...headers,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': totalLen,
    };
    const req = http.request(
      { host: u.hostname, port: u.port, path: u.pathname + u.search, method: 'POST', headers: finalHeaders },
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
    req.write(pre);
    req.write(fileBytes);
    req.write(post);
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
  console.log('\n=== User 模块端到端测试 ==========\n');

  /* ---- 第 1 步：未登录访问 /users/me ---- */
  console.log('[1/8] 未登录 GET /api/users/me → 应 401 拒绝…');
  const anon = await httpJson('GET', `${API}/users/me`);
  const anonDenied = anon.status === 401 || anon.body?.code === 401 || anon.body?.code === 1001;
  check(anonDenied, `HTTP=${anon.status} code=${anon.body?.code}（已拒绝未登录访问）`,
    `未登录应被 401 拒绝，但 HTTP=${anon.status} code=${anon.body?.code}`);

  /* ---- 第 2 步：滑块验证码 → 登录 ---- */
  console.log('\n[2/8] 滑块验证码 → 登录 admin…');
  const captchaRsp = await httpJson('GET', `${API}/auth/captcha`);
  check(captchaRsp.body?.code === 200 && captchaRsp.body?.data?.captchaId,
    '验证码生成成功', `拿不到 captchaId`);
  const captchaId = captchaRsp.body.data.captchaId;
  const redis = new Redis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: 2, enableReadyCheck: true });
  let targetX = null;
  try { targetX = await redis.get(`personal_site:captcha:${captchaId}`); }
  catch (e) { fail(`Redis 读 captcha 失败：${e.message}`); }
  check(targetX != null, `Redis targetX=${targetX}`, 'Redis 未找到 captcha');

  const loginRsp = await httpJson('POST', `${API}/auth/login`, {
    body: { username: 'admin', password: 'admin123', captchaId, slideX: Number(targetX) || 150 },
  });
  check(loginRsp.body?.code === 200, `登录成功 code=${loginRsp.body?.code}`,
    `登录失败：code=${loginRsp.body?.code} msg=${loginRsp.body?.message}`);
  const token = loginRsp.body?.data?.accessToken;
  const authHeader = { Authorization: `Bearer ${token}` };

  /* ---- 第 3 步：登录 GET /users/me ---- */
  console.log('\n[3/8] 登录 GET /api/users/me → 完整字段…');
  const me = await httpJson('GET', `${API}/users/me`, { headers: authHeader });
  check(me.body?.code === 200, `Result.code=200`, `code=${me.body?.code} msg=${me.body?.message}`);
  const u = me.body?.data || {};
  check(u.id === 1, `id=1`, `id=${u.id}`);
  check(u.username === 'admin', `username=admin`, `username=${u.username}`);
  check(typeof u.nickname === 'string' && u.nickname.length > 0, `nickname=${u.nickname}`, 'nickname 空');
  check(typeof u.email === 'string' && u.email.includes('@'), `email=${u.email}`, 'email 格式不对');
  check(u.role === 'admin', `role=admin`, `role=${u.role}`);
  // 暂存原值，用于回滚
  const ORIG_NICK = u.nickname;
  const ORIG_EMAIL = u.email;
  const ORIG_AVATAR = (typeof u.avatar === 'string') ? u.avatar : '';
  check((typeof u.avatar === 'string') || u.avatar === null,
    `avatar 字段存在（${typeof u.avatar === 'string' ? (u.avatar ? u.avatar.length + ' 字符' : '空串') : 'null'}）`,
    'avatar 字段缺失');

  /* ---- 第 4 步：POST /users/me 修改 nickname/email ---- */
  console.log('\n[4/8] POST /api/users/me 修改 nickname + email…');
  const NEW_NICK = 'E2E-测试昵称-' + Date.now();
  const NEW_EMAIL = 'e2e-test-' + Date.now() + '@example.com';
  const updRsp = await httpJson('POST', `${API}/users/me`, {
    body: { nickname: NEW_NICK, email: NEW_EMAIL },
    headers: authHeader,
  });
  check(updRsp.body?.code === 200, `保存成功 code=${updRsp.body?.code} msg=${updRsp.body?.message}`,
    `保存失败：code=${updRsp.body?.code} msg=${updRsp.body?.message}`);
  const upd = updRsp.body?.data || {};
  check(upd.nickname === NEW_NICK, `返回 nickname=${NEW_NICK}`, `返回 nickname=${upd.nickname}`);
  check(upd.email === NEW_EMAIL, `返回 email=${NEW_EMAIL}`, `返回 email=${upd.email}`);
  // 立即 GET 验证
  const me2 = await httpJson('GET', `${API}/users/me`, { headers: authHeader });
  check(me2.body?.data?.nickname === NEW_NICK, `GET 后 nickname=${NEW_NICK}`, 'nickname 未持久化');
  check(me2.body?.data?.email === NEW_EMAIL, `GET 后 email=${NEW_EMAIL}`, 'email 未持久化');

  /* ---- 第 5 步：POST /users/avatar 上传头像 ---- */
  console.log('\n[5/8] POST /api/users/avatar 上传测试头像（小 JPG）…');
  // 生成一张最小合法 JPEG（1x1 灰色 JPG，约 150 字节）
  const tinyJpg = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//Z',
    'base64'
  );
  const up = await httpUpload(`${API}/users/avatar`, 'file', 'e2e-test.jpg', tinyJpg, { headers: authHeader });
  check(up.body?.code === 200, `上传成功 code=${up.body?.code} msg=${up.body?.message}`,
    `上传失败：HTTP=${up.status} code=${up.body?.code} msg=${up.body?.message}`);
  const url = up.body?.data?.url || '';
  check(typeof url === 'string' && url.startsWith('/uploads/avatar/'),
    `返回头像 URL=${url}`, `URL 格式不对：${url}`);
  const after = await httpJson('GET', `${API}/users/me`, { headers: authHeader });
  check(after.body?.data?.avatar === url, `GET 后 avatar=URL 已同步`, `avatar=${after.body?.data?.avatar}`);

  /* ---- 第 6 步：静态资源访问 ---- */
  console.log('\n[6/8] 访问头像静态资源 URL…');
  const av = await httpJson('GET', `${BASE}${url}`);
  check(av.status === 200, `HTTP 200（got ${av.status}）`, `静态资源不可访问：HTTP=${av.status}`);

  /* ---- 第 7 步：DELETE /users/avatar 清除头像 ---- */
  console.log('\n[7/8] DELETE /api/users/avatar → 清除头像…');
  const del = await httpJson('DELETE', `${API}/users/avatar`, { headers: authHeader });
  check(del.body?.code === 200, `清除成功 code=${del.body?.code} msg=${del.body?.message}`,
    `清除失败：code=${del.body?.code}`);
  const me3 = await httpJson('GET', `${API}/users/me`, { headers: authHeader });
  check(me3.body?.data?.avatar === null || me3.body?.data?.avatar === '' || me3.body?.data?.avatar === undefined,
    `清除后 avatar=空（实际：${JSON.stringify(me3.body?.data?.avatar)}）`,
    `清除后 avatar 仍然有值：${me3.body?.data?.avatar}`);

  /* ---- 第 8 步：回滚恢复 ---- */
  console.log('\n[8/8] 回滚：恢复 nickname/email + 恢复头像（非空）…');
  // 使用恒定回滚值（避免上次 E2E 没回滚导致昵称被污染）
  const ROLLBACK_NICK = 'TE';        // admin 用户标准昵称
  const ROLLBACK_EMAIL = '3037749727@qq.com';
  const roll = await httpJson('POST', `${API}/users/me`, {
    body: { nickname: ROLLBACK_NICK, email: ROLLBACK_EMAIL },
    headers: authHeader,
  });
  check(roll.body?.code === 200,
    `回滚 nickname/email 成功 code=${roll.body?.code}（nick=${ROLLBACK_NICK}, email=${ROLLBACK_EMAIL}）`,
    `回滚失败：code=${roll.body?.code}`);
  // 头像：如果原 avatar 有磁盘文件路径（ORIG_AVATAR 非空），不需要再传文件 —— 我们通过上传一张新图保证 DB avatar 非空即可
  // （因为清除接口只清 DB 字段，原磁盘文件可能仍在，但无法通过 DTO 恢复 URL；上传新图是最简单的「有值」回滚方案）
  const rollAv = await httpUpload(`${API}/users/avatar`, 'file', 'rollback-avatar.jpg', tinyJpg, { headers: authHeader });
  if (rollAv.body?.code === 200) {
    pass(`回滚头像：已上传新图 url=${rollAv.body?.data?.url}`);
  } else {
    fail(`回滚头像失败：code=${rollAv.body?.code} msg=${rollAv.body?.message}`);
  }

  try { await redis.quit(); } catch { /* ignore */ }

  console.log('\n=== 完成 ===========================');
  if (process.exitCode) console.log('  有失败项，请检查上面 ❌ 输出');
  else console.log('  🎉 全部 8 步通过！');
}

main().catch((e) => { console.error('❌ 脚本异常：', e); process.exit(1); });
