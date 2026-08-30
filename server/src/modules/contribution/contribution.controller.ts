import {
  Controller,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Result } from '@/common/result';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContributionService } from './contribution.service';
import type { ContributionRsp } from './dto/contribution.dto';

/**
 * Contribution 贡献热力图 Controller
 *
 * 路由分层（对应方案 D 三态）：
 *   · GET /contribution/site     公开（OptionalJWT：游客走 userId=1，admin 走自己 id）
 *   · GET /contribution/github   公开（Phase 2 实现，按 username 查询）
 *   · GET /contribution/merged   公开（Phase 3 实现，SITE + GitHub 合并）
 *
 * 缓存策略：
 *   · Controller 不设 HTTP Cache-Control（热力图变动不频繁但变动时需要立即刷新感知）
 *   · Service 内部管理 Redis 二级缓存（SITE 6h / GITHUB 24h / MERGED 6h）
 */
@ApiTags('贡献热力图 Contribution')
@Controller('contribution')
export class ContributionController {
  constructor(private readonly contributionService: ContributionService) {}

  /* ========== GET /api/contribution/site —— 本站贡献（公开，Phase 1 核心） ========== */

  @UseGuards(OptionalJwtAuthGuard)
  @Get('site')
  @ApiOperation({
    summary: '获取本站贡献热力图（方案 A / 方案 D 的 SITE 来源）—— 游客和登录用户都可访问',
  })
  async getSite(@Req() req: Request): Promise<Result<ContributionRsp>> {
    // 个人博客只有 1 个博主，无 userId 默认走 id=1
    const userId = (req.user as { id?: number } | undefined)?.id ?? 1;
    const data = await this.contributionService.getSiteContribution(userId);
    return Result.ok(data);
  }

  /* ========== GET /api/contribution/github —— Phase 2 占位（当前返回空 cells） ========== */

  @UseGuards(OptionalJwtAuthGuard)
  @Get('github')
  @ApiOperation({
    summary: '[Phase 2 占位] 获取 GitHub 贡献热力图（方案 B）—— 当前返回空网格',
  })
  async getGithub(@Req() req: Request): Promise<Result<ContributionRsp>> {
    // Phase 2：从 About 配置或查询参数取 username，当前固定空
    void req;
    const data = await this.contributionService.getGithubContribution('');
    return Result.ok(data);
  }

  /* ========== GET /api/contribution/merged —— Phase 3 占位（当前走 SITE 代理） ========== */

  @UseGuards(OptionalJwtAuthGuard)
  @Get('merged')
  @ApiOperation({
    summary: '[Phase 3 占位] 获取合并视图热力图（方案 D MERGED）—— 当前返回 SITE 数据打上 MERGED 标签',
  })
  async getMerged(@Req() req: Request): Promise<Result<ContributionRsp>> {
    const userId = (req.user as { id?: number } | undefined)?.id ?? 1;
    const data = await this.contributionService.getMergedContribution(userId);
    return Result.ok(data);
  }

  /* ========== POST /api/contribution/invalidate —— 管理员手动失效缓存（调试用） ========== */

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('invalidate')
  @ApiOperation({
    summary: '[管理员] 手动失效本人贡献缓存（SITE + MERGED + GitHub 若存在）—— 调试/排错用',
  })
  async invalidate(@Req() req: Request): Promise<Result<{ invalidated: boolean }>> {
    const userId = (req.user as { id: number }).id;
    await this.contributionService.invalidateAll(userId);
    return Result.ok({ invalidated: true }, '缓存已失效');
  }
}
