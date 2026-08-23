/**
 * about.ts · 关于我 的 Mock 数据。
 */

export const aboutMe = {
  name: 'Trae',
  shortBio:
    '一个热爱构建的前端工程师，专注 Vue 3 / TypeScript / Tailwind / AI 辅助开发工作流。喜欢把「设计感」和「工程化」拧在一起，也喜欢在长期开源项目里一点点打磨细节。',
  longBio: [
    '2019 年从电子工程跨界到前端，一开始只是想做一个能跑的网页，后来渐渐沉迷于「UI 质感 → 可维护架构 → 工程体验」这一连串的问题。',
    '过去 5 年主要在 B 端中后台、SaaS 产品、以及个人独立项目之间切换；目前正在探索：如何通过 AI Agent + 设计系统把「从想法到上线」的路径压到极致短。',
    '工作之外喜欢看设计史、写博客、做一些永远也发不了版的独立小游戏。如果你也在关心「什么样的工具能让创作者更自由」这件事——欢迎来聊聊。'
  ] as const,
  /** Hero 终端「方向：xxx / yyy」展示用，固定 4 条，前 4 条取最能代表方向。 */
  tags: ['Vue 3 生态', 'TypeScript 工程化', '设计系统与 UI 质感', 'AI Agent 工作流'] as const,
  location: '中国 · 远程协作友好（UTC+8）',
  available: true,
  highlightStats: [
    { label: '年前端经验', value: '5+' },
    { label: '上线项目数', value: '20+' },
    { label: '开源 Star', value: '3.2k' },
    { label: '月均博客字数', value: '8k' }
  ] as const,
  interests: ['设计系统', 'AI Agent 工作流', '独立游戏', '字体与排版', 'WebGL 视觉', '长期主义'] as const
}

/** 技能分组（AboutPage 展示） */
export const skillGroups = [
  {
    id: 'proficient',
    title: '主技术栈 · 熟练使用',
    variant: 'default' as const,
    items: [
      'Vue 3', 'TypeScript', 'Tailwind CSS', 'VueUse', 'Pinia',
      'Vite', 'Vue Router', 'shadcn-vue', 'GSAP', 'HTML / CSS'
    ]
  },
  {
    id: 'familiar',
    title: '熟悉 · 可以直接上手',
    variant: 'secondary' as const,
    items: [
      'React 18', 'Next.js 14', 'Node.js (Express / Fastify)', 'Nuxt 3',
      'Three.js', 'PostgreSQL', 'Redis', 'Jest / Vitest', 'Playwright'
    ]
  },
  {
    id: 'tools',
    title: '协作 · 工具链',
    variant: 'outline' as const,
    items: [
      'Git / GitHub Actions', 'Figma', 'pnpm / npm workspaces',
      'Docker', 'Nginx / Caddy', 'Vercel / Cloudflare Pages', 'Linear / Notion'
    ]
  }
] as const

export type AboutMe = typeof aboutMe
export type SkillGroup = (typeof skillGroups)[number]
