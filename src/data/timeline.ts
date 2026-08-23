/**
 * timeline.ts · 经历时间线 Mock 数据（6 条，按时间由近及远）。
 */

export type TimelineNodeKind = 'work' | 'education' | 'open-source' | 'milestone'

export type TimelineNode = {
  id: string
  kind: TimelineNodeKind
  title: string
  subTitle?: string
  startedAt: string
  endedAt?: string
  /** 是否仍在进行中（会在标题旁显示「进行中」标签） */
  ongoing?: boolean
  description: string
  tags?: string[]
}

export const timelineNodes: TimelineNode[] = [
  {
    id: 't-freelance-2026',
    kind: 'work',
    title: '自由开发者 · 远程协作',
    subTitle: '独立接项目 + 产品化咨询',
    startedAt: '2026-03',
    ongoing: true,
    description:
      '专注 Vue 3 / TypeScript / Design System / AI 辅助开发工作流方向的项目承接与顾问。半年内交付 6 个中大型项目，累计服务客户 12 家，平均 NPS 9.2/10。',
    tags: ['Vue 3', '咨询', '远程']
  },
  {
    id: 't-os-learning-clock',
    kind: 'open-source',
    title: '开源 · Learning Clock In Tracker',
    subTitle: 'Gitee 热门项目 / 周榜前 10（累计 Star 1.4k）',
    startedAt: '2026-01',
    endedAt: '2026-05',
    description:
      '从「自己需要一个打卡工具」开始，在 4 个月内迭代到 1.0 稳定版：对接飞书多维表格 SDK、上线小组看板、GitHub Actions 周报邮件、支持 2 个主题。文档从 0 写到 32 篇，收到 50+ PR/Issue 反馈。',
    tags: ['开源', '多维表格', '社区运营']
  },
  {
    id: 't-milestone-design-system',
    kind: 'milestone',
    title: '里程碑 · 企业设计系统从 0 到 1',
    subTitle: '设计研发对齐问题从 ~15 起/月 降至 ~2 起/月',
    startedAt: '2025-06',
    endedAt: '2025-12',
    description:
      '主导「Figma Variables → 多端代码」的 tokens 管线 + 组件资产库建设，设计组件复用率从 28% 提升至 65%，新组件平均研发周期从 3 天缩短至 0.5 天。',
    tags: ['Design System', '效率', '跨团队']
  },
  {
    id: 't-work-saas-company',
    kind: 'work',
    title: '某 SaaS 创业公司 · 前端工程师（P6）',
    subTitle: '主导产品线迁移 + 工程基建',
    startedAt: '2023-05',
    endedAt: '2026-02',
    description:
      '在约 3 年时间里经历 Vue 2 → Vue 3 + TS 全站迁移、引入 Vite 构建（冷启动从 48s 降至 3.2s）、搭建前端监控 SDK、搭建组件库与 Storybook。带 3 人小组交付 4 条产品线。',
    tags: ['Vue 3', 'SaaS', '工程化', '团队管理']
  },
  {
    id: 't-edu-master',
    kind: 'education',
    title: '某 985 高校 · 电子信息工程硕士',
    subTitle: '方向：计算机视觉 + 嵌入式系统',
    startedAt: '2019-09',
    endedAt: '2022-06',
    description:
      '完成 2 篇会议论文（一作）；参与实验室开源项目「低成本视觉导航小车」并承担 UI/上位机开发。因在项目中发现自己「更喜欢写 UI」，从 EE 跨界到了 Web 前端。',
    tags: ['学历', '跨界', 'CV']
  },
  {
    id: 't-milestone-first-site',
    kind: 'milestone',
    title: '里程碑 · 第一次独立上线完整网站',
    subTitle: '个人博客 v0.1（Hexo + 阿里云 OSS + CDN）',
    startedAt: '2018-07',
    description:
      '第一次完整走完「域名 → 备案 → 图床 → 部署 → SEO → 写第一篇文章」全流程。虽然半年后就没更新了，但那种「我能做出东西给世界看」的感觉之后一直忘不掉。',
    tags: ['起点', '独立', '博客']
  }
]

export const nodeKindMeta: Record<TimelineNodeKind, {
  /** 左侧节点颜色 class（Tailwind bg-*） */
  dotClass: string
  /** Ring 颜色（Tailwind ring-* 或颜色） */
  ringClass: string
  /** 标签颜色（Badge variant） */
  badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive'
  /** 人类可读标签 */
  label: string
}> = {
  work: {
    dotClass: 'bg-danger',
    ringClass: 'ring-danger/15',
    badgeVariant: 'destructive',
    label: '工作经历'
  },
  education: {
    dotClass: 'bg-success',
    ringClass: 'ring-success/15',
    badgeVariant: 'secondary',
    label: '教育背景'
  },
  'open-source': {
    dotClass: 'bg-brand',
    ringClass: 'ring-brand/15',
    badgeVariant: 'default',
    label: '开源项目'
  },
  milestone: {
    dotClass: 'bg-accent',
    ringClass: 'ring-accent/15',
    badgeVariant: 'outline',
    label: '里程碑'
  }
}
