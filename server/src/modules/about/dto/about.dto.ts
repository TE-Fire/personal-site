/**
 * About 模块返回给前端的公开 DTO（GET /api/about data）
 *
 * 统一返回 camelCase，字段含义直接对应前端 3 个消费端：
 *   · AboutPage.vue（短简介/长文/技能/兴趣/nowDoing …）
 *   · HomePage.vue Hero（tags/highlightStats）
 *   · DraggableStatsWidget（name/available/location）
 */
export interface SkillGroupRsp {
  id: string;
  title: string;
  variant: 'default' | 'secondary' | 'outline' | string;
  items: string[];
}

export interface HighlightStatRsp {
  label: string;
  value: string;
}

export interface AboutRsp {
  /** 显示名（直接复用 User.nickname，兜底 username） */
  name: string;
  /** 头像 URL（复用 User.avatar，外链或本地 /uploads/avatar/xxx.png） */
  avatar: string | null;
  /** 短简介（≤300 字，副标题） */
  shortBio: string;
  /** 长文介绍段落数组 */
  longBio: string[];
  /** 高亮数字统计卡片 */
  highlightStats: HighlightStatRsp[];
  /** 位置（如 "中国 · 远程协作友好（UTC+8）"） */
  location: string;
  /** 当前是否可接单 → 绿色 / 灰色 状态指示 */
  available: boolean;
  /** 首页终端打字效果 4 颗方向 tag */
  tags: string[];
  /** 兴趣标签 chips */
  interests: string[];
  /** 技能分组数组（3 组） */
  skillGroups: SkillGroupRsp[];
  /** 现在在做什么 Card 条目（支持 **粗体** inline markdown 语法，前端配合 <strong> 简单渲染） */
  nowDoing: string[];
}
