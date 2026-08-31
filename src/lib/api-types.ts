/**
 * 后端 API 类型定义
 * 与后端 src/modules/auth/dto/auth.dto.ts + captcha/dto/captcha.dto.ts 保持一致
 */

/** 统一响应封装 */
export interface ApiResult<T = unknown> {
  code: number;
  data: T;
  message: string;
}

/** 登录请求参数 */
export interface LoginParams {
  username: string;
  password: string;
  captchaId: string;
  slideX: number;
}

/** 登录响应 */
export interface TokenPayload {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

/** 用户信息 */
export interface UserProfile {
  id: number;
  username: string;
  nickname: string;
  email: string | null;
  avatar: string | null;
  role: string;
}

/** 更新个人资料请求参数 */
export interface UpdateProfileParams {
  nickname?: string;
  email?: string;          // 传 '' 表示清空
  avatar?: string | null; // 传 '' 或 null 表示清空
}

/** 头像上传成功响应 */
export interface AvatarUploadRsp {
  url: string;           // 相对路径，如 /uploads/avatar/xxx.png
  size: number;          // 字节
  mimeType: string;      // image/png 等
  originalName: string;
}

/* ============================================================
 *  About 模块（关于我公开展示 + 管理保存）
 * ============================================================ */

/** 热力图默认显示源（方案 D 三态）—— 与后端 AboutDto.HeatmapSource 保持一致 */
export type HeatmapSource = 'SITE' | 'GITHUB' | 'MERGED';

/** 技能分组（AboutPage "技能 & 工具" section） */
export interface SkillGroup {
  id: string;
  title: string;
  variant: 'default' | 'secondary' | 'outline' | string;
  items: string[];
}

/** 高亮数字统计 chip */
export interface HighlightStat {
  label: string;
  value: string;
}

/** 公开 GET /api/about 返回 */
export interface AboutRsp {
  name: string;
  avatar: string | null;
  shortBio: string;
  longBio: string[];
  highlightStats: HighlightStat[];
  location: string;
  available: boolean;
  tags: string[];
  interests: string[];
  skillGroups: SkillGroup[];
  /** 字符串数组，单项允许 `**粗体**` inline markdown，前端用 <strong> 简单渲染即可 */
  nowDoing: string[];
  // ===== 热力图配置（4 字段，Phase 1 新增；由 Profile Tab1 编辑器读写）=====
  /** 热力图默认显示源 */
  heatmapSource: HeatmapSource;
  /** 是否启用 GitHub 贡献（true=前端显示 GITHUB/MERGED Tab；false=只显示 SITE） */
  heatmapEnableGithub: boolean;
  /** 博主 GitHub 用户名（公开，About 页 "去 GitHub 看更多" 链接用） */
  githubUsername: string;
  /** 博主 GitHub 主页完整链接（空字符串时前端不显示跳转） */
  githubLink: string;
}

/** 管理员 PUT /api/about 入参（不包含 name/avatar，那两个走 User 模块） */
export interface UpdateAboutParams {
  shortBio: string;
  location: string;
  available: boolean;
  longBio: string[];
  tags: string[];
  interests: string[];
  nowDoing: string[];
  highlightStats: HighlightStat[];
  skillGroups: SkillGroup[];
  // ===== 热力图配置（4 字段；Phase 1 后 3 项 UI 上 disabled，但字段仍然统一传递便于保存）=====
  heatmapSource?: HeatmapSource;
  heatmapEnableGithub?: boolean;
  githubUsername?: string;
  githubLink?: string;
}

/* ============================================================
 *  Contribution 模块（贡献热力图 · 方案 D SITE/GITHUB/MERGED 三源）
 * ============================================================ */

/** 单一日期单元格（与后端 DayCellRsp 1:1；与 ContributionHeatmap.vue DayCell 完全一致） */
export interface DayCellRsp {
  /** ISO YYYY-MM-DD（东八区日截断） */
  date: string;
  /** 当日贡献次数 */
  count: number;
  /** 色阶档位（后端统一计算，前端直渲染） */
  level: 0 | 1 | 2 | 3 | 4;
}

/** 统一贡献热力图返回体 —— 三个来源 SITE / GITHUB / MERGED 共用 */
export interface ContributionRsp {
  cells: DayCellRsp[];
  /** 期间总贡献（sum(count)） */
  total: number;
  /** 单日最佳；空态时 date='' count=0 */
  bestDay: { date: string; count: number };
  /** 当前连续活跃天数（从今天倒推 count>0 的连续天数） */
  currentStreak: number;
  /** 期间最长连续活跃天数 */
  longestStreak: number;
  /** 实际来源 */
  source: HeatmapSource | 'SITE' | 'GITHUB' | 'MERGED';
  /** 后端附加元信息（fallback=纯占位、tablesFound=实际聚合成功的业务表；mergedFallback=合并视图实际回退到的单源） */
  meta?: {
    fallback?: boolean;
    tablesFound?: string[];
    githubStale?: boolean;
    /** GITHUB 源请求失败（软过期兜底或无 PAT 兜底），true=显示的是本站数据 */
    githubFailed?: boolean;
    /** MERGED 合并时实际可使用的数据源，'both'=两边都有；其它值=仅那一侧可用（UI 上可以提示用户） */
    mergedFallback?: 'site' | 'github' | 'both';
  };
}

/** 修改密码请求参数 */
export interface ChangePasswordParams {
  oldPassword: string;
  newPassword: string;
}

/** 验证码响应 */
export interface CaptchaResponse {
  captchaId: string;
  bgImage: string;
  puzzleImage: string;
  canvasWidth: number;
  canvasHeight: number;
  puzzleSize: number;
  /** 拼图块的 Y 坐标（缺口的顶部位置） */
  puzzleY: number;
}

/* ==================== Post 模块类型 ==================== */

export type PostStatus = 'draft' | 'published' | 'archived';

export interface PostCategoryVo {
  id: number;
  name: string;
  sort: number;
}

export interface PostTagVo {
  id: number;
  name: string;
}

export interface PostAuthorVo {
  id: number;
  nickname: string;
  avatar: string | null;
}

export interface PostVo {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  /** 列表接口不返回 content，详情接口返回 Markdown 原文 */
  content?: string;
  cover: string | null;
  featured: boolean;
  status: PostStatus;
  wordCount: number;
  readMinutes: number;
  category: PostCategoryVo | null;
  tags: PostTagVo[];
  author: PostAuthorVo;
  createdAt: string;
  updatedAt: string;
}

export interface PostPageVo {
  list: PostVo[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QueryPostParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  categoryId?: number;
  status?: PostStatus;
  featured?: boolean;
  tagIds?: number[];
}

/* ==================== Category 模块类型 ==================== */

export interface CategoryVo {
  id: number;
  name: string;
  sort: number;
  postCount: number;
  createdAt: string;
  updatedAt: string;
}

/* ==================== Tag 模块类型 ==================== */

export interface TagVo {
  id: number;
  name: string;
  postCount: number;
  createdAt: string;
  updatedAt: string;
}
