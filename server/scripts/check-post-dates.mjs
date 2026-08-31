import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const rows = await prisma.$queryRawUnsafe(`
  SELECT id, slug, status, created_at, DATE(created_at) as day
  FROM post
  ORDER BY created_at DESC
  LIMIT 10
`);
console.log('Post 表数据:');
for (const r of rows) {
  console.log(`  id=${r.id} slug=${r.slug} status=${r.status} created_at=${r.created_at} day=${r.day}`);
}
const agg = await prisma.$queryRawUnsafe(`
  SELECT DATE(created_at) AS day, COUNT(*) AS cnt
  FROM post
  WHERE created_at >= '2025-09-01 00:00:00'
    AND created_at <= DATE_ADD('2026-08-31 00:00:00', INTERVAL 1 DAY)
  GROUP BY day
`);
console.log('\n聚合结果:', agg);
await prisma.$disconnect();
