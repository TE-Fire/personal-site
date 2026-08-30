import { BizError, getBizErrorInfo } from './enums/biz-error.enum';
import { IErrorInfo } from './interfaces/error.interface';

/**
 * 通用响应封装 Result<T>
 *
 * 前后端约定统一响应结构：
 *   { code: number, data: T, message: string }
 *
 * ===== Fluent 链式构造（新增）=====
 *   // 成功（链式起点 = 静态工厂）
 *   Result.ok({ id: 1 })
 *         .setMessage('查询成功');
 *
 *   Result.create()
 *         .setCode(200)
 *         .setData({ id: 1 })
 *         .setMessage('success');
 *
 *   // 失败（IErrorInfo 直接作参数，对接枚举契约）
 *   Result.failByError(AuthBizError.PASSWORD_INVALID);
 *   Result.failByError(AuthBizError.PASSWORD_INVALID, '自定义消息');
 *
 * ===== 老用法（100% 兼容，不用改）=====
 *   Result.ok(data) / Result.fail(msg, code)
 */
export class Result<T = unknown> {
  constructor(
    public code: number,
    public data: T,
    public message: string,
  ) {}

  /* ============================================================
   *  静态工厂 —— 链式起点
   * ============================================================ */

  /** 成功响应：传入 data，默认 code=200 message=success */
  static ok<T>(data: T, message = 'success'): Result<T> {
    return new Result<T>(200, data, message);
  }

  /** 失败响应：传 code + message（老写法，继续兼容） */
  static fail<T = null>(
    message = 'request failed',
    code: number = 400,
    data: T | null = null,
  ): Result<T | null> {
    return new Result<T | null>(code, data, message);
  }

  /** 失败响应：基于 IErrorInfo 接口 / 枚举（推荐用法，对接异常契约） */
  static failByError<T = null>(
    error: IErrorInfo | BizError,
    overrideMessage?: string,
    data: T | null = null,
  ): Result<T | null> {
    // 数字枚举：先转 IErrorInfo
    const info: IErrorInfo =
      typeof error === 'number'
        ? getBizErrorInfo(error as BizError)
        : (error as IErrorInfo);
    return new Result<T | null>(
      info.code,
      data,
      overrideMessage ?? info.message,
    );
  }

  /** 通用创建器：code=200 data=null message=success，后续链式设置 */
  static create<T = null>(): Result<T | null> {
    return new Result<T | null>(200, null, 'success');
  }

  /* ============================================================
   *  Fluent Setter —— 每次 return this 实现链式
   * ============================================================ */

  setCode(code: number): this {
    this.code = code;
    return this;
  }

  /** 设置 data（注意：泛型会跟随 data 类型变化，保持类型安全） */
  setData<D>(data: D): Result<D> {
    return new Result<D>(this.code, data, this.message);
  }

  setMessage(message: string): this {
    this.message = message;
    return this;
  }

  /** 基于 IErrorInfo 一次性设置 code + message */
  setError(error: IErrorInfo | BizError): this {
    const info: IErrorInfo =
      typeof error === 'number'
        ? getBizErrorInfo(error as BizError)
        : (error as IErrorInfo);
    this.code = info.code;
    this.message = info.message;
    return this;
  }
}
