/**
 * 通用响应封装 Result<T>
 *
 * 前后端约定统一响应结构：
 * { code: number, data: T, message: string }
 */

export class Result<T = unknown> {
  constructor(
    public code: number,
    public data: T,
    public message: string,
  ) {}

  /* ---------- 快速工厂方法 ---------- */

  static ok<T>(data: T, message = 'success'): Result<T> {
    return new Result<T>(200, data, message);
  }

  static fail<T = null>(
    message = 'request failed',
    code = 400,
    data: T | null = null,
  ): Result<T | null> {
    return new Result<T | null>(code, data, message);
  }
}
