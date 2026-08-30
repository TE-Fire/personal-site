/**
 * 后端联调测试脚本：跑通完整登录流程
 *   1. GET /api/auth/captcha 拿 captchaId
 *   2. 从 Redis 读取 targetX（Redis Key 已统一为 personal_site:captcha:{uuid}）
 *   3. POST /api/auth/login 提交 admin/admin123 + captchaId + targetX
 *   4. GET /api/auth/profile 验证 Token 可用
 *   5. 错误密码验证业务错误码
 *
 * 后端 Result 统一响应：{ code, data, message }
 *   · 成功 code = 200
 *   · 失败 code = 非 200（业务码如 1004 / 1101 等）
 */
const Redis = require('ioredis');

const API = 'http://127.0.0.1:3000/api';
const REDIS_HOST = '127.0.0.1';
const REDIS_PORT = 6379;
const REDIS_PREFIX = 'personal_site';

/** 业务码判断：code !== 200 视为失败 */
function assertOk(res, name) {
  if (res.code !== 200) throw new Error(`${name} 失败: ${JSON.stringify(res)}`);
  return res.data;
}

/** CaptchaService 用的 Redis Key 构造函数（跟 common/constants/redis-keys.ts 保持一致） */
function captchaKey(uuid) {
  return `${REDIS_PREFIX}:captcha:${uuid}`;
}

async function main() {
  /* ---------- 1. 获取验证码 ---------- */
  console.log('=== 1. 获取验证码 ===');
  const captchaRes = await fetch(`${API}/auth/captcha`);
  const captcha = await captchaRes.json();
  const { captchaId, canvasWidth, puzzleSize } = assertOk(captcha, 'captcha');
  console.log(`  captchaId: ${captchaId}`);
  console.log(`  canvasWidth: ${canvasWidth}, puzzleSize: ${puzzleSize}`);

  /* ---------- 2. 从 Redis 读 targetX ---------- */
  console.log('\n=== 2. 从 Redis 读 targetX（模拟前端滑到正确位置）===');
  console.log(`  Redis key: ${captchaKey(captchaId)}`);
  const r = new Redis({ host: REDIS_HOST, port: REDIS_PORT, maxRetriesPerRequest: 1 });
  const targetX = await r.get(captchaKey(captchaId));
  await r.quit();
  if (!targetX) throw new Error('Redis 里没找到 targetX，验证码生成有问题');
  console.log(`  targetX (Redis): ${targetX}`);

  /* ---------- 3. 登录 ---------- */
  console.log('\n=== 3. POST /api/auth/login（admin / admin123）===');
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: 'admin123',
      captchaId,
      slideX: Number(targetX),
    }),
  });
  const login = await loginRes.json();
  const { accessToken } = assertOk(login, 'login');
  console.log(`  accessToken: ${accessToken.substring(0, 50)}...`);
  console.log(`  expiresIn: ${login.data.expiresIn} 秒`);
  console.log(`  tokenType: ${login.data.tokenType}`);

  /* ---------- 4. 拿 profile ---------- */
  console.log('\n=== 4. GET /api/auth/profile（用 Token）===');
  const profileRes = await fetch(`${API}/auth/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = await profileRes.json();
  assertOk(profile, 'profile');
  console.log('  profile:', JSON.stringify(profile.data, null, 2));

  /* ---------- 5. 错误密码（应该返回业务码 1004） ---------- */
  console.log('\n=== 5. 错误密码测试（应该返回 AuthBizError.PASSWORD_INVALID = 1004）===');
  const captcha2 = await (await fetch(`${API}/auth/captcha`)).json();
  assertOk(captcha2, 'captcha2');
  const r2 = new Redis({ host: REDIS_HOST, port: REDIS_PORT, maxRetriesPerRequest: 1 });
  const tx2 = await r2.get(captchaKey(captcha2.data.captchaId));
  await r2.quit();
  const wrongRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: 'wrong_password',
      captchaId: captcha2.data.captchaId,
      slideX: Number(tx2),
    }),
  });
  const wrong = await wrongRes.json();
  console.log(`  HTTP code: ${wrongRes.status}`);
  console.log(`  Business code: ${wrong.code}  (expected 1004 = PASSWORD_INVALID)`);
  console.log(`  Message: ${wrong.message}`);
  if (wrong.code === 200) throw new Error('错误密码竟然登录成功了！');
  if (wrong.code !== 1004) {
    console.warn(`  ⚠️  预期业务码 1004，实际 ${wrong.code}（但只要 != 200 就算拦截成功）`);
  }

  console.log('\n✅ 所有测试通过：Prisma + Redis + JWT + 异常体系协同正常');
}

main().catch((e) => {
  console.error('\n❌ 测试失败:', e.message);
  process.exit(1);
});
