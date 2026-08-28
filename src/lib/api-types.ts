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
