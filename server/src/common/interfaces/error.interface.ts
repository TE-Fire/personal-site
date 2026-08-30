/**
 * 错误信息契约接口 —— 所有错误枚举必须实现该接口
 *
 * 约定（对应 Java: implements IErrorInfo 的枚举类）：
 *   code:    业务错误码（HTTP 层统一用 200，前端根据 code 判断业务成功/失败）
 *   message: 默认错误信息（抛出异常时可传入覆盖）
 *
 * 通用枚举实现：      BizError         (server/src/common/enums/biz-error.enum.ts)
 * 各模块枚举实现：    AuthBizError     (server/src/modules/auth/enums/auth-biz-error.enum.ts)
 *                   CaptchaBizError  (server/src/modules/captcha/enums/captcha-biz-error.enum.ts)
 *                   PostBizError     (后续文章模块)
 *                   ...
 *
 * 使用方（三类都支持）：
 *   throw new BusinessException(AuthBizError.USER_NOT_FOUND)              // 枚举 = 默认消息
 *   throw new BusinessException(AuthBizError.USER_NOT_FOUND, '自定义消息')  // 枚举 + 覆盖消息
 *   throw new BusinessException('参数有误', 400)                            // 老写法兼容
 */
export interface IErrorInfo {
  /** 业务错误码：2xx 成功，4xx/5xx 通用错误，1000+ 模块业务错误 */
  readonly code: number;
  /** 默认错误消息（可在 throw 时覆盖） */
  readonly message: string;
}
