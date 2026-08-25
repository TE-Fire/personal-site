import {
  BadRequestException,
  ValidationPipe,
  ValidationPipeOptions,
} from '@nestjs/common';

/**
 * 全局 DTO 验证管道：
 * - 自动校验 class-validator 装饰器
 * - 把错误信息拼成可读的字符串（避免输出超长的 ValidationError 对象）
 */
export function buildValidationPipe(
  options: ValidationPipeOptions = {},
): ValidationPipe {
  return new ValidationPipe({
    // 转换类型（比如 string → number）
    transform: true,
    // 白名单：未装饰的字段自动剥除
    whitelist: true,
    // 遇到未知字段直接抛错
    forbidNonWhitelisted: false,
    exceptionFactory: (errors) => {
      const msgs = errors
        .map((e) => {
          const constraints = e.constraints ?? {};
          const details = Object.values(constraints).join('; ');
          return `${e.property}: ${details}`;
        })
        .join(' | ');
      return new BadRequestException(`参数校验失败：${msgs}`);
    },
    ...options,
  });
}
