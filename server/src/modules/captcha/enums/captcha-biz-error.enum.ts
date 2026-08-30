import { IErrorInfo } from '../../../common/interfaces/error.interface';

/**
 * Captcha 滑块验证码模块业务错误枚举 —— 实现 IErrorInfo 契约
 * 码段：1100 ~ 1199
 */
export enum CaptchaBizError {
  /** 校验失败（位置偏差超过容差） */
  VERIFY_FAILED = 1101,
  /** 验证码已过期（Redis 查不到） */
  EXPIRED = 1102,
  /** 验证码已被使用过（一次性消费） */
  ALREADY_USED = 1103,
  /** 缺少验证码参数（captchaId 或 slideX 未传） */
  MISSING_PARAM = 1104,
  /** 背景图目录为空，无法生成验证码 */
  NO_BACKGROUND_IMAGE = 1105,
}

const CAPTCHA_ERROR_MSG: Record<CaptchaBizError, string> = {
  [CaptchaBizError.VERIFY_FAILED]: '验证失败，请重新拖动滑块',
  [CaptchaBizError.EXPIRED]: '验证码已过期，请重新获取',
  [CaptchaBizError.ALREADY_USED]: '验证码已使用过，请重新获取',
  [CaptchaBizError.MISSING_PARAM]: '缺少验证码参数',
  [CaptchaBizError.NO_BACKGROUND_IMAGE]: '验证码服务暂不可用（背景图缺失）',
};

/** CaptchaBizError → IErrorInfo（类型安全转换） */
export function getCaptchaErrorInfo(err: CaptchaBizError): IErrorInfo {
  return {
    code: Number(err),
    message: CAPTCHA_ERROR_MSG[err],
  };
}
