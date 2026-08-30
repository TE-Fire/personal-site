/**
 * About 字段种子脚本（幂等 · 不覆盖已存在的有效值）。
 *
 * 用法：
 *   cd server ; node scripts/seed-about-defaults.mjs
 *
 * 策略：
 *   读取 user 表的 admin 行（id=1），若某个 about_* 列 是 ''/[]/NULL（即默认初始值），
 *   就把前端 data/about.ts 对应的值写进去。已有非空有效值的列 = 保留用户手动改过的，不覆盖。
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/* =================== 前端 data/about.ts 的默认值（保持完全一致） =================== */
const DEFAULTS = {
  aboutShortBio:
    '一个热爱构建的前端工程师，专注 Vue 3 / TypeScript / Tailwind / AI 辅助开发工作流。喜欢把「设计感」和「工程化」拧在一起，也喜欢在长期开源项目里一点点打磨细节。',
  aboutLongBio: [
    '2019 年从电子工程跨界到前端，一开始只是想做一个能跑的网页，后来渐渐沉迷于「UI 质感 → 可维护架构 → 工程体验」这一连串的问题。',
    '过去 5 年主要在 B 端中后台、SaaS 产品、以及个人独立项目之间切换；目前正在探索：如何通过 AI Agent + 设计系统把「从想法到上线」的路径压到极致短。',
    '工作之外喜欢看设计史、写博客、做一些永远也发不了版的独立小游戏。如果你也在关心「什么样的工具能让创作者更自由」这件事——欢迎来聊聊。',
  ],
  aboutSkills: [
    {
      id: 'proficient',
      title: '主技术栈 · 熟练使用',
      variant: 'default',
      items: ['Vue 3', 'TypeScript', 'Tailwind CSS', 'VueUse', 'Pinia', 'Vite', 'Vue Router', 'shadcn-vue', 'GSAP', 'HTML / CSS'],
    },
    {
      id: 'familiar',
      title: '熟悉 · 可以直接上手',
      variant: 'secondary',
      items: ['React 18', 'Next.js 14', 'Node.js (Express / Fastify)', 'Nuxt 3', 'Three.js', 'PostgreSQL', 'Redis', 'Jest / Vitest', 'Playwright'],
    },
    {
      id: 'tools',
      title: '协作 · 工具链',
      variant: 'outline',
      items: ['Git / GitHub Actions', 'Figma', 'pnpm / npm workspaces', 'Docker', 'Nginx / Caddy', 'Vercel / Cloudflare Pages', 'Linear / Notion'],
    },
  ],
  aboutHighlightStats: [
    { label: '年前端经验', value: '5+' },
    { label: '上线项目数', value: '20+' },
    { label: '开源 Star', value: '3.2k' },
    { label: '月均博客字数', value: '8k' },
  ],
  aboutInterests: ['设计系统', 'AI Agent 工作流', '独立游戏', '字体与排版', 'WebGL 视觉', '长期主义'],
  aboutTags: ['Vue 3 生态', 'TypeScript 工程化', '设计系统与 UI 质感', 'AI Agent 工作流'],
  aboutLocation: '中国 · 远程协作友好（UTC+8）',
  aboutAvailable: true,
  aboutNowDoing: [
    '🪴 **产品**：把「AI 辅助开发工作流」做成一个可复现的模板项目，并在 Gitee / GitHub 同步更新。',
    '📝 **写作**：保持 2~3 篇 / 月的节奏，主题集中在工程笔记、踩坑复盘、读书摘要三条线。',
    '🔍 **寻找**：有趣的独立项目 / 长期开源协作 / 设计系统类咨询。',
    '🛠️ **技能打磨**：正在啃 Three.js + WebGPU 的入门教程，目标 Q4 能出一个完整的 3D 小玩具。',
  ],
}

const isEmptyStringOrNull = (v) => v == null || v === ''
// JSON 列：老行可能是 NULL（Prisma runtime @default("[]") 对存量不回溯）或者真的空数组
const isEmptyJsonArray = (v) => v == null || (typeof v === 'object' && Array.isArray(v) && v.length === 0)

async function main() {
  const user = await prisma.user.findFirst({ where: { id: 1 } })
  if (!user) {
    console.error('❌ 没有找到 id=1 的 admin 用户，请先执行 prisma/init.sql 初始化 user 表')
    process.exit(1)
  }

  const patch = {}

  if (isEmptyStringOrNull(user.aboutShortBio)) patch.aboutShortBio = DEFAULTS.aboutShortBio
  if (isEmptyJsonArray(user.aboutLongBio))          patch.aboutLongBio  = DEFAULTS.aboutLongBio
  if (isEmptyJsonArray(user.aboutSkills))           patch.aboutSkills   = DEFAULTS.aboutSkills
  if (isEmptyJsonArray(user.aboutHighlightStats))   patch.aboutHighlightStats = DEFAULTS.aboutHighlightStats
  if (isEmptyJsonArray(user.aboutInterests))        patch.aboutInterests = DEFAULTS.aboutInterests
  if (isEmptyJsonArray(user.aboutTags))             patch.aboutTags     = DEFAULTS.aboutTags
  if (isEmptyStringOrNull(user.aboutLocation))      patch.aboutLocation = DEFAULTS.aboutLocation
  if (typeof user.aboutAvailable !== 'boolean')     patch.aboutAvailable = DEFAULTS.aboutAvailable
  if (isEmptyJsonArray(user.aboutNowDoing))         patch.aboutNowDoing = DEFAULTS.aboutNowDoing

  if (Object.keys(patch).length === 0) {
    console.log('ℹ️  所有 About 字段都已有有效值，跳过写入（幂等）')
    return
  }

  console.log('将为 id=1 写入/补齐以下 About 默认字段：', Object.keys(patch))
  await prisma.user.update({ where: { id: 1 }, data: patch })

  // 再读一遍给人看
  const updated = await prisma.user.findFirst({
    where: { id: 1 },
    select: {
      nickname: true,
      aboutShortBio: true,
      aboutLocation: true,
      aboutAvailable: true,
      aboutTags: true,
      aboutHighlightStats: true,
      aboutInterests: true,
    },
  })
  console.log('✅ 写入完成。字段摘要：')
  console.log(JSON.stringify(updated, null, 2))
}

main()
  .catch((e) => {
    console.error('❌ seed 失败：', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
