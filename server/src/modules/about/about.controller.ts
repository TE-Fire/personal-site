import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Result } from '@/common/result';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { REDIS_TTL } from '@/common/constants/redis-keys';
import { AboutService } from './about.service';
import { UpdateAboutDto } from './dto/update-about.dto';
import type { AboutRsp } from './dto/about.dto';

/**
 * About 模块 Controller
 *   · GET  /about     公开（游客 / admin 都可看），加 Cache-Control 1 min
 *   · PUT  /about     需 admin 登录（JWT），管理保存
 *   · GET  /about 的缓存由 Service 内部 Redis 再控制一层（双重缓存）
 */
@ApiTags('关于我 About')
@Controller('about')
export class AboutController {
  constructor(private readonly aboutService: AboutService) {}

  /* ========== GET /api/about —— 公开 ========== */

  @Get()
  @ApiOperation({
    summary: '获取公开的「关于我」展示数据（游客可看，1 分钟 HTTP 缓存 + Redis 缓存）',
  })
  async getAbout(@Res({ passthrough: true }) res: Response): Promise<Result<AboutRsp>> {
    // 浏览器/CDN 级 HTTP 缓存：60s（公开 + 最大 60s）。
    // 实际一致性由 Service 层 Redis 保证（admin 改完会主动删 Redis key）。
    res.setHeader(
      'Cache-Control',
      `public, max-age=${REDIS_TTL.ABOUT_PUBLIC}`,
    );
    res.setHeader('Vary', 'Accept');
    const data = await this.aboutService.getPublicAbout();
    return Result.ok(data);
  }

  /* ========== PUT /api/about —— 管理员改 ========== */

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put()
  @ApiOperation({
    summary: '保存「关于我」展示字段（admin 登录后通过 /profile Tab2 编辑器调用）',
  })
  async updateAbout(
    @Req() req: Request,
    @Body() dto: UpdateAboutDto,
  ): Promise<Result<AboutRsp>> {
    const userId = (req.user as { id: number }).id;
    const data = await this.aboutService.saveAbout(userId, dto);
    return Result.ok(data, '保存成功');
  }
}
