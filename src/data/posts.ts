/**
 * posts.ts · 博客 Mock 数据（8 篇，按发布时间倒序排列）。
 */

export type BlogPost = {
  slug: string
  title: string
  excerpt: string
  /** 正文预估字数（200 字/分钟向上取整 = 阅读时长） */
  wordCount: number
  publishedAt: string
  /** 分类（可由用户在管理弹窗中增删改，故用 string 而非联合类型） */
  category: string
  tags: string[]
  /** 是否首页展示（首页只展示前 3 条 highlight=true 的） */
  featured: boolean
}

export const posts: BlogPost[] = [
  {
    slug: 'vibecoding-in-practice',
    title: '我用 vibecoding 重做了一次个人站：AI 批量产出 vs 人做语义校验',
    excerpt:
      'vibecoding 的「规划 → 执行 → 验证 → 交付」流程到底能把一个中等复杂度项目压缩到多少步？在这篇文里，我把最近重做个人站的完整过程、决策点、以及 AI 最容易翻车的 3 个阶段摊开来看。',
    wordCount: 4200,
    publishedAt: '2026-08-18',
    category: '工程笔记',
    tags: ['vibecoding', 'AI 辅助开发', '个人项目'],
    featured: true
  },
  {
    slug: 'tailwind-via-design-tokens',
    title: '为什么我不再在 Tailwind 里写「md:text-2xl lg:text-3xl」—— 用 design tokens 统一设计语言',
    excerpt:
      '如果你也厌倦了在 20 个页面里复制同一套字号-间距组合，也许可以把「设计决策」从组件里抬出来一层：用 CSS 变量 + tokens.css 做唯一真源，Tailwind 变成 tokens 的搬运工。',
    wordCount: 3100,
    publishedAt: '2026-08-02',
    category: '设计系统',
    tags: ['Tailwind', 'Design Tokens', 'CSS Variables'],
    featured: true
  },
  {
    slug: 'vue-composables-that-i-wrote-10-times',
    title: '我在每个 Vue 3 项目都会复制的 5 个 composable：从 useTheme 到 useRequest',
    excerpt:
      'useTheme / useRequest / useElementSize / useIntersectionObserver / useMediaQuery 是我复制粘贴率最高的 5 个。本文给出每个的 30 行以内版本 + 设计取舍 + 真实用例。',
    wordCount: 5200,
    publishedAt: '2026-07-11',
    category: '工程笔记',
    tags: ['Vue 3', 'Composable', 'VueUse'],
    featured: true
  },
  {
    slug: 'shadcn-vue-init-gotchas',
    title: 'shadcn-vue init 的 3 个坑与回退：CLI 阻塞、references tsconfig、风格重命名',
    excerpt:
      '当阻塞式 shell 遇上交互式 CLI，当 Vue 官方 references 模板遇上 shadcn-vue 的静态扫描，当 new-york 突然被 vega / nova / maia 替换 —— 我如何在 20 分钟内把 init 过程从「卡成狗」切到「手动但稳定」。',
    wordCount: 2800,
    publishedAt: '2026-06-20',
    category: '踩坑复盘',
    tags: ['shadcn-vue', 'CLI', 'TypeScript'],
    featured: false
  },
  {
    slug: 'book-notes-the-pragmatic-programmer',
    title: '重读《程序员修炼之道》：我 25 岁和 30 岁读的是两本完全不同的书',
    excerpt:
      '同样是讲「提示 23 · 估算」和「提示 41 · 不要靠巧合编程」，第一遍读是「哦对哦」，第二遍读是冷汗。把那些反复踩坑后才真正理解的 10 条建议摘出来。',
    wordCount: 3900,
    publishedAt: '2026-05-05',
    category: '读书摘要',
    tags: ['读书', '职业成长'],
    featured: false
  },
  {
    slug: 'from-idea-to-ship-30-days',
    title: '从一个模糊的产品想法到上线：我 30 天做独立项目的日程安排',
    excerpt:
      '不需要全职，不需要融资；每天 2 小时 + 周末半天。关键是把「30 天」拆成 3 段：调研期、构建期、打磨期，每段时间都做对优先级。',
    wordCount: 2400,
    publishedAt: '2026-03-27',
    category: '产品思考',
    tags: ['独立项目', '日程安排', 'MVP'],
    featured: false
  },
  {
    slug: 'why-i-started-to-write',
    title: '我为什么重新开始写博客：写给自己，顺便让世界看到',
    excerpt:
      '停更 2 年，重开时我花了很长时间想清楚「为谁写」这个问题。答案很朴素：先写给 1 年后的自己看；如果顺便有人能受益，那就是额外的奖赏。',
    wordCount: 1600,
    publishedAt: '2026-01-12',
    category: '生活随笔',
    tags: ['写作', '长期主义'],
    featured: false
  },
  {
    slug: 'csp-iframe-and-me',
    title: '一次 CSP + iframe + SameSite=Lax 引发的 4 小时调试',
    excerpt:
      '控制台有 3 条毫不相关的报错；A 页面能登录 B 页面不能；只有 Chrome 90+ 能复现。把这次「现象/根因/处理/反思」按时间顺序记录下来，下次遇到类似能节省 3 小时。',
    wordCount: 3600,
    publishedAt: '2025-11-02',
    category: '踩坑复盘',
    tags: ['CSP', 'SameSite', 'iframe', '调试'],
    featured: false
  }
]

export function readingMinutes(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 200))
}

/** 内置默认分类（用户可在管理弹窗中增删改，存储在 localStorage） */
export const postArticleCategories: string[] = ['工程笔记', '读书摘要', '踩坑复盘', '产品思考', '生活随笔', '设计系统']
export type PostArticleCategory = string

/** 筛选用分类（含「全部」）—— 动态来源，此处仅为类型导出 */
export type PostCategory = string

export function listPostTags(): string[] {
  const set = new Set<string>()
  posts.forEach(p => p.tags.forEach(t => set.add(t)))
  return Array.from(set).sort()
}
