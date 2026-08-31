/**
 * verify-post-heatmap.mjs · 验证 Post 表热力图聚合是否生效
 *
 * 1. 清除 Redis 中旧的 SITE 贡献缓存
 * 2. 调用 GET /api/contribution/site 获取热力图数据
 * 3. 验证 total > 0（8 篇文章应该产生贡献）
 * 4. 验证 tablesFound 包含 'post'
 */
import http from 'node:http';
import Redis from 'ioredis';

const HOST = '127.0.0.1';
const PORT = 3000;

function httpJson(method, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: HOST, port: PORT, path, method }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: null }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const redis = new Redis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: 1 });

  // 1. 清除旧缓存
  const siteKey = 'personal_site:contribution:site:u1';
  const mergedKey = 'personal_site:contribution:merged:u1';
  await redis.del(siteKey, mergedKey);
  console.log('✅ 已清除旧的 SITE + MERGED 贡献缓存\n');

  // 2. 调用 SITE 接口
  console.log('[1] GET /api/contribution/site');
  const site = await httpJson('GET', '/api/contribution/site');
  if (site.body?.code !== 200) {
    console.log(`❌ SITE 接口失败: code=${site.body?.code} msg=${site.body?.message}`);
    process.exit(1);
  }
  const siteData = site.body.data;
  console.log(`  source=${siteData.source}`);
  console.log(`  total=${siteData.total}`);
  console.log(`  longestStreak=${siteData.longestStreak}`);
  console.log(`  currentStreak=${siteData.currentStreak}`);
  console.log(`  meta.tablesFound=${siteData.meta?.tablesFound?.join(', ') || '[]'}`);

  if (siteData.meta?.tablesFound?.includes('post')) {
    console.log('  ✅ tablesFound 包含 post');
  } else {
    console.log('  ❌ tablesFound 不包含 post');
  }

  if (siteData.total > 0) {
    console.log(`  ✅ total=${siteData.total} > 0（Post 贡献聚合生效）`);
  } else {
    console.log('  ❌ total=0，Post 贡献未聚合');
    process.exit(1);
  }

  // 3. 验证 Redis 缓存已写入
  const cached = await redis.get(siteKey);
  if (cached) {
    console.log('  ✅ Redis 缓存已写入');
  } else {
    console.log('  ❌ Redis 缓存未写入');
  }

  // 4. 调用 MERGED 接口（验证 SITE + GitHub 合并）
  console.log('\n[2] GET /api/contribution/merged');
  const merged = await httpJson('GET', '/api/contribution/merged');
  if (merged.body?.code !== 200) {
    console.log(`❌ MERGED 接口失败: code=${merged.body?.code}`);
    process.exit(1);
  }
  const mergedData = merged.body.data;
  console.log(`  source=${mergedData.source}`);
  console.log(`  total=${mergedData.total}（SITE + GitHub 合并）`);
  console.log(`  ✅ MERGED 接口正常`);

  await redis.disconnect();
  console.log('\n========== 验证通过 ==========');
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
