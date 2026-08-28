/**
 * 后端联调测试脚本：跑通完整登录流程
 *   1. GET /api/auth/captcha 拿 captchaId
 *   2. 从 Redis 读取 targetX（模拟前端拖到正确位置）
 *   3. POST /api/auth/login 提交 admin/admin123 + captchaId + targetX
 *   4. GET /api/auth/profile 验证 Token 可用
 *
 * 后端 Result 统一响应：{ code, data, message }
 *   · 成功 code = 200
 *   · 失败 code = 400 / 401 / 500 等（非 200 即失败）
 */
const Redis = require('ioredis');

const API = 'http://127.0.0.1:3000/api';

/** 业务码判断：code !== 200 视为失败 */
function assertOk(res, name) {
  if (res.code !== 200) throw new Error(`${name} 失败: ${JSON.stringify(res)}`);
  return res.data;
}

async function main() {
  console.log('=== 1. 获取验证码 ===');
  const captchaRes = await fetch(`${API}/auth/captcha`);
  const captcha = await captchaRes.json();
  const { captchaId, canvasWidth, puzzleSize } = assertOk(captcha, 'captcha');
  console.log(`  captchaId: ${captchaId}`);
  console.log(`  canvasWidth: ${canvasWidth}, puzzleSize: ${puzzleSize}`);

  console.log('\n=== 2. 从 Redis 读 targetX（模拟前端滑到正确位置）===');
  const r = new Redis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: 1 });
  const targetX = await r.get(`captcha:${captchaId}`);
  await r.quit();
  if (!targetX) throw new Error('Redis 里没找到 targetX，验证码生成有问题');
  console.log(`  targetX (Redis): ${targetX}`);

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

  console.log('\n=== 4. GET /api/auth/profile（用 Token）===');
  const profileRes = await fetch(`${API}/auth/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = await profileRes.json();
  assertOk(profile, 'profile');
  console.log('  profile:', JSON.stringify(profile.data, null, 2));

  console.log('\n=== 5. 错误密码测试（应该 401）===');
  const captcha2 = await (await fetch(`${API}/auth/captcha`)).json();
  const r2 = new Redis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: 1 });
  const tx2 = await r2.get(`captcha:${captcha2.data.captchaId}`);
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
  console.log(`  Business code: ${wrong.code}`);
  console.log(`  Message: ${wrong.message}`);
  if (wrong.code === 200) throw new Error('错误密码竟然登录成功了！');

  console.log('\n✅ 所有测试通过：Prisma + Redis + JWT 三件套协同正常');
}

main().catch((e) => {
  console.error('\n❌ 测试失败:', e.message);
  process.exit(1);
});

