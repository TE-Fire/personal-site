import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BusinessException } from './exception';
import { Result } from './result';
import { BizError, getBizErrorInfo } from './enums/biz-error.enum';

/**
 * 全局异常过滤器 —— 按你方案分两类处理：业务异常 / 其他异常
 *
 * 处理优先级（自上而下匹配，命中即停止）：
 *   1. BusinessException  → 直接用 info.code 和 info.message，HTTP 状态=200（业务码段 >1000）
 *   2. HttpException      → 转换为通用 BizError 对应码；4xx 走前端业务判断；5xx 打日志
 *   3. 其他 Error         → BizError.SERVER_ERROR(500)，打印完整堆栈，生产环境不暴露细节
 *   4. 兜底（非 Error 抛字符串/对象）→ 500
 *
 * 响应契约：
 *   成功/失败 都是 HTTP 200，前端根据 Result.code 判断
 *   - code === 200 → 成功
 *   - code !== 200 → 失败，取 message 展示
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    /* ========== 1. 业务异常：拿 info 直接用（枚举→IErrorInfo 已在构造函数里解析好） ========== */
    if (exception instanceof BusinessException) {
      const { info } = exception;
      return res
        .status(200)
        .json(Result.fail(info.message, info.code));
    }

    /* ========== 2. HttpException：Nest 内置异常，转换为 BizError 契约 ========== */
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resp = exception.getResponse();
      const rawMsg =
        typeof resp === 'string'
          ? resp
          : Array.isArray((resp as any)?.message)
            ? (resp as any).message.join('; ')
            : (resp as any)?.message ?? exception.message;

      // class-validator 参数校验失败会返回 400 Bad Request + 多条 message
      if (status === HttpStatus.BAD_REQUEST) {
        const info = getBizErrorInfo(BizError.BAD_REQUEST);
        // 参数校验优先显示具体错在哪，便于前端调
        const msg = rawMsg && rawMsg !== 'Bad Request' ? rawMsg : info.message;
        return res
          .status(200)
          .json(Result.fail(msg, info.code));
      }

      // 401 / 403 / 404 / 405 / 429 精确映射到 BizError
      const bizMap: Record<number, BizError> = {
        [HttpStatus.UNAUTHORIZED]: BizError.UNAUTHORIZED,
        [HttpStatus.FORBIDDEN]: BizError.FORBIDDEN,
        [HttpStatus.NOT_FOUND]: BizError.NOT_FOUND,
        [HttpStatus.METHOD_NOT_ALLOWED]: BizError.METHOD_NOT_ALLOWED,
        429: BizError.TOO_MANY_REQUESTS,
      };
      if (bizMap[status]) {
        const info = getBizErrorInfo(bizMap[status]);
        const msg = rawMsg && rawMsg !== defaultStatusMsg(status) ? rawMsg : info.message;
        return res
          .status(200)
          .json(Result.fail(msg, info.code));
      }

      // 5xx 系列 HttpException
      if (status >= 500) {
        this.logger.error(
          `[HTTP 5xx] [${req.method}] ${req.originalUrl}`,
          exception.stack,
        );
        const info = getBizErrorInfo(BizError.SERVER_ERROR);
        return res.status(200).json(Result.fail(info.message, info.code));
      }

      // 其他 4xx 没配映射 → 统一 BAD_REQUEST 兜底
      return res
        .status(200)
        .json(Result.fail(rawMsg || '请求失败', status));
    }

    /* ========== 3. 通用 Error：500 兜底，记录详细日志 ========== */
    if (exception instanceof Error) {
      this.logger.error(
        `[Uncaught Error] [${req.method}] ${req.originalUrl}`,
        exception.stack,
      );
      const info = getBizErrorInfo(BizError.SERVER_ERROR);
      return res.status(200).json(Result.fail(info.message, info.code));
    }

    /* ========== 4. 终极兜底（有人 throw 非 Error 类型，如字符串/对象字面量） ========== */
    this.logger.error(
      `[Unknown throw] [${req.method}] ${req.originalUrl}`,
      String(exception),
    );
    const info = getBizErrorInfo(BizError.SERVER_ERROR);
    res.status(200).json(Result.fail(info.message, info.code));
  }
}

/* ---------------- 辅助 ---------------- */
function defaultStatusMsg(status: number): string {
  switch (status) {
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not Found';
    case 405:
      return 'Method Not Allowed';
    case 429:
      return 'Too Many Requests';
    default:
      return '';
  }
}
