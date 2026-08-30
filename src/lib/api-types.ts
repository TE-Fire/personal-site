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
