import { BizError, getBizErrorInfo } from './enums/biz-error.enum';
import { IErrorInfo } from './interfaces/error.interface';
import { AuthBizError, getAuthErrorInfo } from '../modules/auth/enums/auth-biz-error.enum';
import { CaptchaBizError, getCaptchaErrorInfo } from '../modules/captcha/enums/captcha-biz-error.enum';
import { PostBizError, getPostErrorInfo } from '../modules/post/enums/post-biz-error.enum';
import { LifeBizError, getLifeErrorInfo } from '../modules/life/enums/life-biz-error.enum';
import { UserBizError, getUserErrorInfo } from '../modules/user/enums/user-biz-error.enum';

/**
 * 兼容旧骨架里的 BizCode 引用（BizCode 现在拆分了 → BizError 通用 + 各模块枚举）
 * 旧代码 import { BizCode } 依旧能用，建议后续逐步迁移到模块枚举。
 */
export { BizError as BizCode };

/**
 * 业务异常类（核心抛出对象）
 *
 * 构造函数支持 4 种重载，全部通过 resolve() 分发：
 *
 *   1️⃣  传枚举 + 可选覆盖消息（推荐）—— 所有模块枚举都是 number
 *          throw new BusinessException(AuthBizError.PASSWORD_INVALID)
 *          throw new BusinessException(AuthBizError.PASSWORD_INVALID, '自定义提示')
 *          throw new BusinessException(BizError.BAD_REQUEST)
 *          throw new BusinessException(PostBizError.NOT_FOUND)
 *
 *   2️⃣  传 IErrorInfo 接口对象（任何实现该接口的对象均可，含后续新增枚举）
 *          throw new BusinessException({ code: 9999, message: '自定义业务错' })
 *
 *   3️⃣  传 message + code（老写法兼容）
 *          throw new BusinessException('参数校验失败', 400)
 *
 *   4️⃣  只传 message（code 默认 500）
 *          throw new BusinessException('未知异常')
 */
export class BusinessException extends Error {
  public readonly code: number;

  /** 解析后的完整错误信息（IErrorInfo 契约，只读） */
  public readonly info: IErrorInfo;

  /* ---- 重载签名（调用方只能看到这 3 种形式，第 4 种「只传 number 枚举」走第 1 个） ---- */
  constructor(message: string, code?: number);
  constructor(info: IErrorInfo);
  // TS enum 底层是 number，所有模块枚举（BizError / AuthBizError / CaptchaBizError / PostBizError / LifeBizError / UserBizError / 后续模块）都匹配这里
  constructor(errCode: number, overrideMessage?: string);
  constructor(
    arg1: string | IErrorInfo | number,
    arg2?: number | string,
  ) {
    const info = resolve(arg1, arg2);
    super(info.message);
    this.name = 'BusinessException';
    this.code = info.code;
    this.info = info;
  }
}

/* ============================================================
 *  多态解析：把 4 种入参形式归一化成 IErrorInfo
 *
 *  注意：所有模块枚举的 message 映射表都在各自 enum 文件定义。
 *  新增模块时，只需：
 *    1) 创建 modules/{xxx}/enums/{xxx}-biz-error.enum.ts（码段预留好）
 *    2) 在本文件顶部 import
 *    3) 在 resolve 的 Case C 追加一个 if 分支
 * ============================================================ */
function resolve(
  arg1: string | IErrorInfo | number,
  arg2?: number | string,
): IErrorInfo {
  // ---- Case A: arg1 是字符串 message ----
  if (typeof arg1 === 'string') {
    return {
      code: typeof arg2 === 'number' ? arg2 : 500,
      message: arg1,
    };
  }

  // ---- Case B: arg1 是 IErrorInfo 对象（有 code + message 属性） ----
  if (
    typeof arg1 === 'object' &&
    arg1 !== null &&
    typeof (arg1 as IErrorInfo).code === 'number' &&
    typeof (arg1 as IErrorInfo).message === 'string'
  ) {
    // arg2 是字符串 = 覆盖默认 message（重建对象，避免修改只读原对象）
    if (typeof arg2 === 'string') {
      return { code: (arg1 as IErrorInfo).code, message: arg2 };
    }
    return { ...(arg1 as IErrorInfo) };
  }

  // ---- Case C: arg1 是 number（所有模块枚举都走到这里，按码段分发） ----
  if (typeof arg1 === 'number') {
    // 400~499 / 500~599 / 200 → 通用 BizError
    if ((arg1 >= 400 && arg1 <= 499) || (arg1 >= 500 && arg1 <= 599) || arg1 === 200) {
      return withOverride(getBizErrorInfo(arg1 as BizError), arg2);
    }
    // 1000~1099 → auth
    if (arg1 >= 1000 && arg1 <= 1099) {
      return withOverride(getAuthErrorInfo(arg1 as AuthBizError), arg2);
    }
    // 1100~1199 → captcha
    if (arg1 >= 1100 && arg1 <= 1199) {
      return withOverride(getCaptchaErrorInfo(arg1 as CaptchaBizError), arg2);
    }
    // 2000~2099 → post
    if (arg1 >= 2000 && arg1 <= 2099) {
      return withOverride(getPostErrorInfo(arg1 as PostBizError), arg2);
    }
    // 3000~3099 → life
    if (arg1 >= 3000 && arg1 <= 3099) {
      return withOverride(getLifeErrorInfo(arg1 as LifeBizError), arg2);
    }
    // 4000~4099 → user
    if (arg1 >= 4000 && arg1 <= 4099) {
      return withOverride(getUserErrorInfo(arg1 as UserBizError), arg2);
    }
    // 未知码段（后续模块还没注册分支）→ 数字兜底
    return {
      code: arg1,
      message: typeof arg2 === 'string' ? arg2 : `业务错误 (code=${arg1})`,
    };
  }

  // ---- Fallback：都不匹配就 500 ----
  return { code: 500, message: '服务端异常' };
}

/** 辅助：若 override 为 string 则重建 IErrorInfo 覆盖 message，否则原样返回副本 */
function withOverride(info: IErrorInfo, override: number | string | undefined): IErrorInfo {
  if (typeof override === 'string') {
    return { code: info.code, message: override };
  }
  return { ...info };
}
