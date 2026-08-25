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

/**
 * 全局异常过滤器：捕获所有异常 → 统一返回 Result 结构
 *
 * - HttpException: NestJS 内置异常，直接拿 status
 * - BusinessException: 业务抛出的异常，拿自定义 code
 * - 其他: 500 兜底，并打印错误日志
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    let code = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';

    /* ---------- 异常分类处理 ---------- */
    if (exception instanceof BusinessException) {
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      code = exception.getStatus();
      const resp = exception.getResponse();
      message =
        typeof resp === 'string'
          ? resp
          : (resp as any)?.message ?? exception.message;
    } else if (exception instanceof Error) {
      message = exception.message || message;
      this.logger.error(
        `[${req.method}] ${req.url}`,
        exception.stack,
      );
    }

    res
      .status(code >= 1000 ? 200 : code)
      .json(Result.fail(message, code));
  }
}
