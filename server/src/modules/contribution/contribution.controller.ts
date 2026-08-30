import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Result } from '@/common/result';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '@/common/prisma.service';
import { ContributionService } from './contribution.service';
import type { ContributionRsp } from './dto/contribution.dto';

/**
 * Contribution 贡献热力图 Controller
 *
 * 路由分层（方案 D 三态全部 Phase 2 交付）：
 *   · GET /contribution/site     公开（OptionalJWT：游客走 userId=1，admin 走自己 id）
 *   · GET /contribution/github   公开（query.username 可选，优先级 入参>DB>GITHUB_USERNAME env）
 *   · GET /contribution/merged   公开（SITE + GitHub 合并，双源失败降级）
 *   · GET /contribution/invalidate [JWT] 手动失效缓存（调试用）
 *
 * GitHub 启用策略（防止前端禁用了但后端仍能直接抓真实数据）：
 *   · 先读 DB 中 aboutHeatmapEnableGithub（无 userId=1 默认行 → 视为 true，以 env 兜底）
 *   · aboutHeatmapEnableGithub=false → 对 GitHub / merged 中的 GitHub 部分返回 fallback 空
 */
@ApiTags('贡献热力图 Contribution')
@Controller('contribution')
export class ContributionController {
  constructor(
    private readonly contributionService: ContributionService,
    private readonly prisma: PrismaService,
  ) {}

  /** 内部：根据 userId 查 DB 热力图开关 + GitHub 用户名（无行给默认值） */
  private async resolveGithubConfig(userId: number): Promise<{
    enableGithub: boolean;
    dbGithubUsername: string;
  }> {
    try {
      const row = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          aboutHeatmapEnableGithub: true,
          aboutGithubUsername: true,
        },
      });
      return {
        enableGithub: row ? Boolean(row.aboutHeatmapEnableGithub) : true,
        dbGithubUsername: row?.aboutGithubUsername?.trim() ?? '',
      };
    } catch (_) {
      return { enableGithub: true, dbGithubUsername: '' };
    }
  }

  /* ========== GET /api/contribution/site ========== */

  @UseGuards(OptionalJwtAuthGuard)
  @Get('site')
  @ApiOperation({ summary: '获取本站贡献热力图（公开，游客和登录用户均可访问）' })
  async getSite(@Req() req: Request): Promise<Result<ContributionRsp>> {
    const userId = (req.user as { id?: number } | undefined)?.id ?? 1;
    const data = await this.contributionService.getSiteContribution(userId);
    return Result.ok(data);
  }

  /* ========== GET /api/contribution/github ========== */

  @UseGuards(OptionalJwtAuthGuard)
  @Get('github')
  @ApiOperation({
    summary: '获取 GitHub 贡献热力图（公开）—— query.username 可选，不传走 DB 配置或 env',
  })
  async getGithub(
    @Req() req: Request,
    @Query('username') usernameQuery?: string,
  ): Promise<Result<ContributionRsp>> {
    const userId = (req.user as { id?: number } | undefined)?.id ?? 1;
    const { enableGithub, dbGithubUsername } = await this.resolveGithubConfig(userId);
    const data = await this.contributionService.getGithubContribution(
      usernameQuery,
      dbGithubUsername,
      enableGithub,
    );
    return Result.ok(data);
  }

  /* ========== GET /api/contribution/merged ========== */

  @UseGuards(OptionalJwtAuthGuard)
  @Get('merged')
  @ApiOperation({
    summary: '获取合并视图热力图（SITE + GitHub 按日期累加；任一源失败自动降级）',
  })
  async getMerged(
    @Req() req: Request,
    @Query('username') usernameQuery?: string,
  ): Promise<Result<ContributionRsp>> {
    const userId = (req.user as { id?: number } | undefined)?.id ?? 1;
    const { enableGithub, dbGithubUsername } = await this.resolveGithubConfig(userId);
    const data = await this.contributionService.getMergedContribution(
      userId,
      usernameQuery,
      dbGithubUsername,
      enableGithub,
    );
    return Result.ok(data);
  }

  /* ========== GET /api/contribution/invalidate —— 管理员手动失效缓存 ========== */

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('invalidate')
  @ApiOperation({
    summary: '[管理员] 手动失效本人贡献缓存（SITE + MERGED + 当前 DB 的 GitHub 用户名 key）',
  })
  async invalidate(@Req() req: Request): Promise<Result<{ invalidated: boolean }>> {
    const userId = (req.user as { id: number }).id;
    const { dbGithubUsername } = await this.resolveGithubConfig(userId);
    await this.contributionService.invalidateAll(userId, [dbGithubUsername]);
    return Result.ok({ invalidated: true }, '缓存已失效');
  }
}
