/**
 * seed-life.mjs · 导入 25 条生活碎片（8 照片 + 5 音乐 + 6 随笔 + 3 足迹 + 3 书影）
 *
 * 幂等设计：先清空 life_moment 表，再按原始顺序插入（sortOrder 0,1,2...）。
 * 数据源自 src/data/life.ts（PhotoMoment / MusicMoment / EssayMoment）。
 *
 * 运行：node seed-life.mjs
 */
import { PrismaClient, LifeMomentType, LifeStatus } from '@prisma/client';

const prisma = new PrismaClient();

/* ---------- 8 条照片数据（源自 src/data/life.ts · photoMoments） ---------- */
const PHOTOS = [
  { id: 'p-001', date: '2026.08.20', title: '城市黄昏',   gradient: { from: '#7c3aed', to: '#f59e0b' }, mood: '灵感', span: 2, height: 'lg' },
  { id: 'p-002', date: '2026.08.18', title: '咖啡店角落', gradient: { from: '#92400e', to: '#fbbf24' }, mood: '日常',             height: 'md' },
  { id: 'p-003', date: '2026.08.15', title: '周末徒步',   gradient: { from: '#059669', to: '#34d399' }, mood: '旅行',             height: 'sm' },
  { id: 'p-004', date: '2026.08.12', title: '深夜书桌',   gradient: { from: '#1e1b4b', to: '#6366f1' }, mood: '深夜', span: 2, height: 'xl' },
  { id: 'p-005', date: '2026.08.08', title: '巷口的猫',   gradient: { from: '#831843', to: '#f472b6' }, mood: '治愈',             height: 'md' },
  { id: 'p-006', date: '2026.08.03', title: '海边日落',   gradient: { from: '#0c4a6e', to: '#38bdf8' }, mood: '释然',             height: 'lg' },
  { id: 'p-007', date: '2026.07.28', title: '早餐合集',   gradient: { from: '#fde68a', to: '#f97316' }, mood: '美食',             height: 'sm' },
  { id: 'p-008', date: '2026.07.22', title: '雨后玻璃',   gradient: { from: '#64748b', to: '#0ea5e9' }, mood: '日常',             height: 'md' },
];

/* ---------- 5 条音乐数据（源自 src/data/life.ts · musicMoments） ---------- */
const MUSICS = [
  { id: 'm-001', date: '2026.08.21', title: '晴天',                          artist: '周杰伦',     playCount: 12, link: 'https://music.163.com/song?id=186016', coverColor: '#7c3aed', mood: '治愈', comment: '前奏一响，就回到了那个夏天' },
  { id: 'm-002', date: '2026.08.19', title: '夜空中最亮的星',                artist: '逃跑计划',   playCount: 8,  link: 'https://music.163.com/song?id=254574', coverColor: '#06b6d4', mood: '深夜', comment: '凌晨写代码的 BGM，循环到天亮' },
  { id: 'm-003', date: '2026.08.16', title: 'Hotel California',              artist: 'Eagles',     playCount: 5,  link: 'https://music.163.com/song?id=259867', coverColor: '#ec4899', mood: '灵感', comment: '吉他 Solo 每次听都起鸡皮疙瘩' },
  { id: 'm-004', date: '2026.08.10', title: 'Merry Christmas Mr. Lawrence',  artist: '坂本龍一',   playCount: 6,  link: 'https://music.163.com/song?id=257733', coverColor: '#f59e0b', mood: '释然', comment: '大师走后，曲子反而更亮了' },
  { id: 'm-005', date: '2026.08.05', title: 'Valder Fields',                 artist: 'Tamas Wells', playCount: 4,  link: 'https://music.163.com/song?id=202568', coverColor: '#10b981', mood: '日常', comment: '适合发呆时单曲循环' },
];

/* ---------- 6 条随笔数据（源自 src/data/life.ts · essayMoments） ---------- */
const ESSAYS = [
  { id: 'e-001', date: '2026.08.20', content: '今天的晚霞是紫色的，像极了我配不出的那个渐变色值。#f0 #9d',                 mood: '灵感', gradient: { from: '#7c3aed', to: '#f59e0b' } },
  { id: 'e-002', date: '2026.08.18', content: '凌晨三点写完了最后一个 bug，窗外第一缕光打在屏幕上，像极了 deploy 成功的绿色。', mood: '深夜' },
  { id: 'e-003', date: '2026.08.15', content: '老巷口的猫又来了，它蹲在窗台上看我敲代码的样子，像在做 code review。',         mood: '治愈', gradient: { from: '#831843', to: '#f472b6' } },
  { id: 'e-004', date: '2026.08.10', content: '海风很咸，浪声很白。坐在礁石上放空了两个小时，脑子里一个 var 都没有。',         mood: '释然', gradient: { from: '#0c4a6e', to: '#38bdf8' } },
  { id: 'e-005', date: '2026.08.06', content: '新买了一盆绿萝，放在显示器旁边。写代码写到卡壳时就看看它，它也不急，绿油油的。', mood: '日常' },
  { id: 'e-006', date: '2026.07.30', content: '今天煮了一碗面，放了两个荷包蛋。幸福有时候就是多加一个蛋这么简单。',             mood: '美食', gradient: { from: '#fde68a', to: '#f97316' } },
];

/* ---------- 3 条足迹数据 ---------- */
const FOOTPRINTS = [
  { id: 'f-001', date: '2026.04.15', title: '西湖漫步',    location: '杭州·西湖',     content: '春日的西湖，湖面像一块摊开的丝绸。走了一圈白堤，看到三个人在不同的地方钓鱼。', mood: '治愈' },
  { id: 'f-002', date: '2025.11.22', title: '重庆一日游',  location: '重庆·洪崖洞',   content: '坐了一趟过江索道，晚上去了洪崖洞。重庆的火锅比想象中更辣，也比想象中更好吃。', mood: '兴奋' },
  { id: 'f-003', date: '2025.10.01', title: '南京中山陵', location: '南京·中山陵',   content: '国庆节去的，人比台阶还多。但爬到顶看到整个南京的那一刻，觉得值了。',             mood: '日常' },
];

/* ---------- 3 条书影数据 ---------- */
const BOOKNOTES = [
  { id: 'b-001', date: '2026.03.10', title: '代码大全（第二版）', author: 'Steve McConnell',        bookType: 'book',  rating: 5, content: '编程界的圣经。不是教你写代码，是教你怎么把代码写成人能读的东西。', mood: '灵感' },
  { id: 'b-002', date: '2026.02.20', title: '沙丘',              author: 'Frank Herbert',          bookType: 'book',  rating: 5, content: '科幻的尽头是哲学，哲学的尽头是沙丘。宇宙的本质是盐和时间。',         mood: '灵感' },
  { id: 'b-003', date: '2025.12.31', title: '盗梦空间',          author: '克里斯托弗·诺兰',        bookType: 'movie', rating: 5, content: '跨年刷的。陀螺停没停不重要，重要的是你愿意相信什么是真实的。',         mood: '释然' },
];

/** 'YYYY.MM.DD' → UTC ISO DateTime（如 2026-08-20T00:00:00.000Z） */
function toDate(dotDate) {
  const [y, m, d] = dotDate.split('.');
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
}

async function main() {
  console.log('🌱 seed-life 开始...\n');

  // 1. 清空旧数据（DELETE FROM life_moment）
  await prisma.lifeMoment.deleteMany({});
  console.log('🧹 已清空 life_moment 旧数据\n');

  let sort = 0;
  let inserted = 0;

  // 2.1 照片：title / gradientFrom / gradientTo / mood / span(默认1) / heightKey
  for (const p of PHOTOS) {
    const row = await prisma.lifeMoment.create({
      data: {
        type: LifeMomentType.PHOTO,
        status: LifeStatus.PUBLISHED,
        title: p.title,
        date: toDate(p.date),
        mood: p.mood,
        sortOrder: sort++,
        gradientFrom: p.gradient.from,
        gradientTo: p.gradient.to,
        span: p.span ?? 1,
        heightKey: p.height,
      },
    });
    inserted++;
    console.log(`  📷 #${row.id} ${p.id} ${p.title}  [span=${p.span ?? 1} h=${p.height}]`);
  }

  // 2.2 音乐：title / artist / playCount / externalLink=link / coverColor / mood / comment
  for (const m of MUSICS) {
    const row = await prisma.lifeMoment.create({
      data: {
        type: LifeMomentType.MUSIC,
        status: LifeStatus.PUBLISHED,
        title: m.title,
        date: toDate(m.date),
        mood: m.mood,
        sortOrder: sort++,
        artist: m.artist,
        playCount: m.playCount,
        externalLink: m.link,
        coverColor: m.coverColor,
        comment: m.comment,
      },
    });
    inserted++;
    console.log(`  🎵 #${row.id} ${m.id} ${m.title} - ${m.artist}  [▶${m.playCount}]`);
  }

  // 2.3 随笔：content / mood / gradientFrom / gradientTo（可选）
  for (const e of ESSAYS) {
    const row = await prisma.lifeMoment.create({
      data: {
        type: LifeMomentType.ESSAY,
        status: LifeStatus.PUBLISHED,
        content: e.content,
        date: toDate(e.date),
        mood: e.mood,
        sortOrder: sort++,
        gradientFrom: e.gradient?.from,
        gradientTo: e.gradient?.to,
      },
    });
    inserted++;
    console.log(`  ✍️  #${row.id} ${e.id}  [${e.mood}]${e.gradient ? ' +gradient' : ''}`);
  }

  // 2.4 足迹：title / locationName / content / mood
  for (const f of FOOTPRINTS) {
    const row = await prisma.lifeMoment.create({
      data: {
        type: LifeMomentType.FOOTPRINT,
        status: LifeStatus.PUBLISHED,
        title: f.title,
        content: f.content,
        date: toDate(f.date),
        mood: f.mood,
        sortOrder: sort++,
        locationName: f.location,
      },
    });
    inserted++;
    console.log(`  🗺  #${row.id} ${f.id} ${f.title} @ ${f.location}`);
  }

  // 2.5 书影：title / bookAuthor / bookType / rating / content / mood
  for (const b of BOOKNOTES) {
    const row = await prisma.lifeMoment.create({
      data: {
        type: LifeMomentType.BOOKNOTE,
        status: LifeStatus.PUBLISHED,
        title: b.title,
        content: b.content,
        date: toDate(b.date),
        mood: b.mood,
        sortOrder: sort++,
        bookAuthor: b.author,
        bookType: b.bookType,
        rating: b.rating,
      },
    });
    inserted++;
    const typeIcon = b.bookType === 'movie' ? '🎬' : '📖';
    console.log(`  ${typeIcon} #${row.id} ${b.id} ${b.title} - ${b.author}  ★${b.rating}`);
  }

  // 3. 统计输出
  const total = await prisma.lifeMoment.count();
  const byType = await prisma.lifeMoment.groupBy({
    by: ['type'],
    _count: { _all: true },
    orderBy: { type: 'asc' },
  });

  console.log(`\n✅ seed-life 完成！`);
  console.log(`   本次插入 ${inserted} 条，数据库现有 ${total} 条`);
  console.log(`   按类型：${byType.map((t) => `${t.type}=${t._count._all}`).join('  ')}`);
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
