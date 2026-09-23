/**
 * seed-works.mjs · 导入 6 条精选作品（源自 src/data/projects.ts）
 *
 * 幂等设计：用 upsert（where: { slug }），重复执行不报错。
 * 字段映射：前端 id → slug；sortOrder = 数组索引；status = PUBLISHED。
 *
 * 运行：node prisma/seed-works.mjs
 */
import { PrismaClient, WorkStatus } from '@prisma/client';

const prisma = new PrismaClient();

/* ---------- 6 条作品数据（源自 src/data/projects.ts） ---------- */
const WORKS = [
  {
    slug: 'p-personal-site-2026',
    title: '个人作品集（本站）',
    summary: 'Vue 3 + Vite + Tailwind，AI 辅助开发（vibecoding）工作流验证项目。',
    description:
      '完整实践了从需求拆解 → 方案文档 → Git 约定 → 设计系统 → 布局路由 → 页面填充的 vibecoding 全流程，重点在「AI 批量产出 + 人做语义校验」的边界。',
    cover: 'from-brand/30 via-accent/30 to-chart-c1/30',
    tags: ['Vue 3', 'Tailwind', 'Vite', 'TypeScript', 'vibecoding'],
    category: '独立项目',
    links: { repo: 'https://github.com/TE-Fire/personal-site' },
    finishedAt: '2026-08',
    highlight: true,
  },
  {
    slug: 'p-learning-clock',
    title: 'Learning Clock In Tracker',
    summary: 'Gitee 上开源的「学习打卡小工具」，多维表格驱动、支持小组共享看板。',
    description:
      'Vue 3 + TypeScript + Tailwind + lark-base SDK，把打卡、小组排名、连续天数、周报总结做成了「零后端」的纯静态站，数据直接写飞书多维表格。GitHub Actions 每周自动发送统计邮件。',
    cover: 'from-chart-c2/30 via-brand/30 to-surface-muted',
    tags: ['Vue 3', 'lark-base', 'GitHub Actions', '多维表格', '无后端'],
    category: '开源协作',
    links: { repo: 'https://gitee.com/TE-Fire/learning-clock-in-tracker' },
    finishedAt: '2026-05',
    highlight: true,
  },
  {
    slug: 'p-vue-admin-starter',
    title: 'Vue 3 Admin Starter',
    summary: '一套极简企业中后台脚手架（RBAC + 动态菜单 + 表格/表单生成器）。',
    description:
      '基于 Vite 5 + Pinia + Element Plus 封装，内置登录态、按钮级权限、页面级权限、i18n 三语、打包分析；配套 CLI 模板一键生成 CRUD 页面，平均减少 60% 重复代码。',
    cover: 'from-chart-c3/30 via-accent/30 to-chart-c4/30',
    tags: ['Vue 3', 'Pinia', 'Element Plus', 'Vite', '权限系统'],
    category: 'Web 应用',
    links: { demo: 'https://example.com/vue-admin-starter' },
    finishedAt: '2025-12',
    highlight: true,
  },
  {
    slug: 'p-ai-chatbot',
    title: 'Doc Chatbot 知识库助手',
    summary: '企业私有知识库检索聊天机器人，RAG 管线 + Vue 3 对话 UI。',
    description:
      '后端 FastAPI + LangChain + Qdrant，前端 Vue 3 完整实现 Markdown 渲染、代码高亮、流式 SSE、引用来源卡片、会话侧栏、导出 PDF。在 300+ 人内部使用，知识库命中准确率约 92%。',
    cover: 'from-chart-c5/30 via-brand/30 to-chart-c2/30',
    tags: ['Vue 3', 'RAG', 'SSE', 'Markdown', '企业内部'],
    category: 'Web 应用',
    links: {},
    finishedAt: '2025-09',
    highlight: false,
  },
  {
    slug: 'p-design-tokens-pipeline',
    title: 'Figma → 代码 设计 Token 管线',
    summary: '自动把 Figma 设计变量同步为多端代码资源，消除「设计-代码」视觉漂移。',
    description:
      '用 Figma Variables API 拉取颜色/字号/间距/圆角/阴影，生成 tokens.css + tailwind.config.ts + iOS/Android 资源文件，支持多主题版本。上线后设计研发对齐问题从每月 ~15 起降至 ~2 起。',
    cover: 'from-chart-c1/30 via-chart-c4/30 to-chart-c3/30',
    tags: ['Design System', 'Figma API', 'Node.js', '多主题', 'DX'],
    category: '设计系统',
    links: {},
    finishedAt: '2025-06',
    highlight: false,
  },
  {
    slug: 'p-3d-product-showcase',
    title: '3D 产品展示台（Three.js）',
    summary: '独立项目：基于 Three.js 的产品 3D 交互展示样板，支持光照切换+热点标注+AR 预览。',
    description:
      'Three.js + postprocessing 后处理 + GSAP 滚动叙事，热点以 Radix Popover 形式展示细节参数，WebXR 不支持时自动降级为全景视图。首屏 Lighthouse 性能 96 分。',
    cover: 'from-accent/30 via-chart-c5/30 to-brand/30',
    tags: ['Three.js', 'GSAP', 'Postprocessing', 'WebXR', '独立项目'],
    category: '独立项目',
    links: { demo: 'https://example.com/3d-product-showcase' },
    finishedAt: '2025-03',
    highlight: false,
  },
];

async function main() {
  console.log('🌱 seed-works 开始...\n');

  let inserted = 0;

  for (let i = 0; i < WORKS.length; i++) {
    const w = WORKS[i];
    const row = await prisma.work.upsert({
      where: { slug: w.slug },
      create: {
        slug: w.slug,
        title: w.title,
        summary: w.summary,
        description: w.description,
        cover: w.cover,
        tags: w.tags,
        category: w.category,
        links: w.links,
        finishedAt: w.finishedAt,
        highlight: w.highlight,
        sortOrder: i,
        status: WorkStatus.PUBLISHED,
      },
      update: {
        title: w.title,
        summary: w.summary,
        description: w.description,
        cover: w.cover,
        tags: w.tags,
        category: w.category,
        links: w.links,
        finishedAt: w.finishedAt,
        highlight: w.highlight,
        sortOrder: i,
        status: WorkStatus.PUBLISHED,
      },
    });
    inserted++;
    console.log(`  🎨 #${row.id} ${w.slug} ${w.title}  [sort=${i}${w.highlight ? ' ⭐' : ''}]`);
  }

  const total = await prisma.work.count();
  console.log(`\n✅ seed-works 完成！`);
  console.log(`   本次 upsert ${inserted} 条作品`);
  console.log(`   数据库现有 ${total} 条作品`);
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
