/**
 * 一次性迁移：把 work.cover 从 Tailwind 类名（从未真正渲染成功）
 * 迁移为标准 CSS gradient 表达式。幂等——已是 CSS 渐变的记录跳过。
 */
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

const MAP = {
  'from-brand/30 via-accent/30 to-chart-c1/30':
    'linear-gradient(135deg, rgba(75,63,227,0.35), rgba(39,210,191,0.35), rgba(34,165,247,0.35))',
  'from-chart-c2/30 via-brand/30 to-surface-muted':
    'linear-gradient(135deg, rgba(169,174,255,0.45), rgba(75,63,227,0.30), rgba(203,213,225,0.40))',
  'from-chart-c3/30 via-accent/30 to-chart-c4/30':
    'linear-gradient(135deg, rgba(60,46,202,0.35), rgba(39,210,191,0.35), rgba(111,111,255,0.35))',
  'from-chart-c5/30 via-brand/30 to-chart-c2/30':
    'linear-gradient(135deg, rgba(34,165,247,0.40), rgba(75,63,227,0.30), rgba(169,174,255,0.40))',
  'from-chart-c1/30 via-chart-c4/30 to-chart-c3/30':
    'linear-gradient(135deg, rgba(60,46,202,0.30), rgba(34,165,247,0.40), rgba(111,111,255,0.35))',
  'from-accent/30 via-chart-c5/30 to-brand/30':
    'linear-gradient(135deg, rgba(39,210,191,0.40), rgba(34,165,247,0.30), rgba(75,63,227,0.35))',
};

const works = await p.work.findMany({ select: { id: true, title: true, cover: true } });
let n = 0;
for (const w of works) {
  const next = MAP[w.cover];
  if (!next) continue;
  await p.work.update({ where: { id: w.id }, data: { cover: next } });
  console.log(`✓ #${w.id} ${w.title}`);
  n++;
}
console.log(`migrated ${n}/${works.length}`);
await p.$disconnect();
