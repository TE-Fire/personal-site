/**
 * seed-posts.mjs · 导入 8 篇内置文章 + 6 个分类 + 所有标签
 *
 * 幂等设计：用 upsert（where: { slug } / { name }），重复执行不报错。
 * 正文生成：用模板 + 填充，长度接近 wordCount。
 *
 * 运行：node scripts/seed-posts.mjs
 */
import { PrismaClient, PostStatus } from '@prisma/client';

const prisma = new PrismaClient();

/* ---------- 8 篇文章数据（源自 src/data/posts.ts） ---------- */
const POSTS = [
  { slug: 'vibecoding-in-practice', title: '我用 vibecoding 重做了一次个人站：AI 批量产出 vs 人做语义校验',
    excerpt: 'vibecoding 的「规划 → 执行 → 验证 → 交付」流程到底能把一个中等复杂度项目压缩到多少步？在这篇文里，我把最近重做个人站的完整过程、决策点、以及 AI 最容易翻车的 3 个阶段摊开来看。',
    wordCount: 4200, publishedAt: '2026-08-18', category: '工程笔记', tags: ['vibecoding', 'AI 辅助开发', '个人项目'], featured: true },
  { slug: 'tailwind-via-design-tokens', title: '为什么我不再在 Tailwind 里写「md:text-2xl lg:text-3xl」—— 用 design tokens 统一设计语言',
    excerpt: '如果你也厌倦了在 20 个页面里复制同一套字号-间距组合，也许可以把「设计决策」从组件里抬出来一层：用 CSS 变量 + tokens.css 做唯一真源，Tailwind 变成 tokens 的搬运工。',
    wordCount: 3100, publishedAt: '2026-08-02', category: '设计系统', tags: ['Tailwind', 'Design Tokens', 'CSS Variables'], featured: true },
  { slug: 'vue-composables-that-i-wrote-10-times', title: '我在每个 Vue 3 项目都会复制的 5 个 composable：从 useTheme 到 useRequest',
    excerpt: 'useTheme / useRequest / useElementSize / useIntersectionObserver / useMediaQuery 是我复制粘贴率最高的 5 个。本文给出每个的 30 行以内版本 + 设计取舍 + 真实用例。',
    wordCount: 5200, publishedAt: '2026-07-11', category: '工程笔记', tags: ['Vue 3', 'Composable', 'VueUse'], featured: true },
  { slug: 'shadcn-vue-init-gotchas', title: 'shadcn-vue init 的 3 个坑与回退：CLI 阻塞、references tsconfig、风格重命名',
    excerpt: '当阻塞式 shell 遇上交互式 CLI，当 Vue 官方 references 模板遇上 shadcn-vue 的静态扫描，当 new-york 突然被 vega / nova / maia 替换 —— 我如何在 20 分钟内把 init 过程从「卡成狗」切到「手动但稳定」。',
    wordCount: 2800, publishedAt: '2026-06-20', category: '踩坑复盘', tags: ['shadcn-vue', 'CLI', 'TypeScript'], featured: false },
  { slug: 'book-notes-the-pragmatic-programmer', title: '重读《程序员修炼之道》：我 25 岁和 30 岁读的是两本完全不同的书',
    excerpt: '同样是讲「提示 23 · 估算」和「提示 41 · 不要靠巧合编程」，第一遍读是「哦对哦」，第二遍读是冷汗。把那些反复踩坑后才真正理解的 10 条建议摘出来。',
    wordCount: 3900, publishedAt: '2026-05-05', category: '读书摘要', tags: ['读书', '职业成长'], featured: false },
  { slug: 'from-idea-to-ship-30-days', title: '从一个模糊的产品想法到上线：我 30 天做独立项目的日程安排',
    excerpt: '不需要全职，不需要融资；每天 2 小时 + 周末半天。关键是把「30 天」拆成 3 段：调研期、构建期、打磨期，每段时间都做对优先级。',
    wordCount: 2400, publishedAt: '2026-03-27', category: '产品思考', tags: ['独立项目', '日程安排', 'MVP'], featured: false },
  { slug: 'why-i-started-to-write', title: '我为什么重新开始写博客：写给自己，顺便让世界看到',
    excerpt: '停更 2 年，重开时我花了很长时间想清楚「为谁写」这个问题。答案很朴素：先写给 1 年后的自己看；如果顺便有人能受益，那就是额外的奖赏。',
    wordCount: 1600, publishedAt: '2026-01-12', category: '生活随笔', tags: ['写作', '长期主义'], featured: false },
  { slug: 'csp-iframe-and-me', title: '一次 CSP + iframe + SameSite=Lax 引发的 4 小时调试',
    excerpt: '控制台有 3 条毫不相关的报错；A 页面能登录 B 页面不能；只有 Chrome 90+ 能复现。把这次「现象/根因/处理/反思」按时间顺序记录下来，下次遇到类似能节省 3 小时。',
    wordCount: 3600, publishedAt: '2025-11-02', category: '踩坑复盘', tags: ['CSP', 'SameSite', 'iframe', '调试'], featured: false },
];

/** 6 个内置分类 */
const CATEGORIES = ['工程笔记', '读书摘要', '踩坑复盘', '产品思考', '生活随笔', '设计系统'];

/** 生成模拟 Markdown 正文 */
function genContent(p) {
  const fill = `这是「${p.title}」的正文段落。`.repeat(Math.max(1, Math.ceil(p.wordCount / 20)));
  return `# ${p.title}\n\n${p.excerpt}\n\n## 正文\n\n${fill}\n\n## 总结\n\n感谢阅读。`;
}

async function main() {
  console.log('🌱 seed-posts 开始...\n');

  // 1. 获取 admin 用户
  const admin = await prisma.user.findFirst({ where: { username: 'admin' } });
  if (!admin) throw new Error('找不到 admin 用户，请先执行 init.sql 或 seed-about-defaults.mjs');
  console.log(`✅ admin 用户 id=${admin.id}`);

  // 2. upsert 分类
  const catMap = new Map(); // name → id
  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = await prisma.category.upsert({
      where: { name: CATEGORIES[i] },
      create: { name: CATEGORIES[i], sort: i, authorId: admin.id },
      update: { sort: i },
    });
    catMap.set(CATEGORIES[i], c.id);
    console.log(`  📁 分类 #${c.id} ${c.name}`);
  }

  // 3. upsert 标签
  const allTagNames = [...new Set(POSTS.flatMap((p) => p.tags))].sort();
  const tagMap = new Map(); // name → id
  for (const name of allTagNames) {
    const t = await prisma.tag.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    tagMap.set(name, t.id);
  }
  console.log(`  🏷️  标签 ${allTagNames.length} 个：${allTagNames.join(', ')}`);

  // 4. upsert 文章
  for (const p of POSTS) {
    const content = genContent(p);
    const realWordCount = content.length;
    const readMinutes = Math.max(1, Math.ceil(realWordCount / 500));
    const categoryId = catMap.get(p.category);
    const tagIds = p.tags.map((t) => tagMap.get(t));

    const post = await prisma.post.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        content,
        cover: p.featured ? `/uploads/covers/${p.slug}.jpg` : null,
        featured: p.featured,
        status: PostStatus.PUBLISHED,
        wordCount: realWordCount,
        readMinutes,
        author: { connect: { id: admin.id } },
        category: { connect: { id: categoryId } },
        tags: { create: tagIds.map((id) => ({ tag: { connect: { id } } })) },
      },
      update: {
        title: p.title,
        excerpt: p.excerpt,
        content,
        cover: p.featured ? `/uploads/covers/${p.slug}.jpg` : null,
        featured: p.featured,
        status: PostStatus.PUBLISHED,
        wordCount: realWordCount,
        readMinutes,
        category: { connect: { id: categoryId } },
        tags: {
          deleteMany: {},
          create: tagIds.map((id) => ({ tag: { connect: { id } } })),
        },
      },
    });
    console.log(`  📝 文章 #${post.id} ${post.slug} (${post.wordCount}字 ${post.readMinutes}分钟)`);
  }

  // 5. 统计
  const counts = await Promise.all([
    prisma.post.count(),
    prisma.category.count(),
    prisma.tag.count(),
    prisma.postTag.count(),
  ]);
  console.log(`\n✅ seed-posts 完成！`);
  console.log(`   Post=${counts[0]} Category=${counts[1]} Tag=${counts[2]} PostTag=${counts[3]}`);
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
