import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController, ApiOperation } from '@nestjs/swagger';
import { Result } from '@/common/result';

/**
 * 健康检查 & 根路由
 */
@ApiExcludeController()
@Controller()
export class AppController {
  @Get('health')
  @ApiOperation({ summary: '健康检查' })
  health(): Result<{ ok: true; time: string }> {
    return Result.ok({ ok: true, time: new Date().toISOString() });
  }
}
