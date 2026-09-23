import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import type { Response } from 'express';
import { Result } from '@/common/result';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { REDIS_TTL } from '@/common/constants/redis-keys';
import { PortfolioService } from './portfolio.service';
import {
  CreateWorkDto,
  UpdateWorkDto,
  ReorderWorksDto,
  CreateVocabDto,
  RenameVocabDto,
  WorkRsp,
  WorkMetaRsp,
  VocabKind,
} from './dto/portfolio.dto';
import { WorkCoverStorageService } from './work-cover-storage.service';

/* ---------- 作品封面图上传 Multer 配置 ---------- */
const WORK_UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'works');
/** 上传硬上限 12MB（存储服务二次校验到 10MB 并给出友好提示） */
const WORK_UPLOAD_MAX_SIZE = 12 * 1024 * 1024;

const workCoverStorage = diskStorage({
  destination: (_req, _file, cb) => {
    if (!existsSync(WORK_UPLOAD_DIR)) {
      mkdirSync(WORK_UPLOAD_DIR, { recursive: true });
    }
    cb(null, WORK_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const ext = extname(file.originalname).toLowerCase() || '.bin';
    cb(null, `${stamp}-${rand}${ext}`);
  },
});

/**
 * Portfolio 模块 Controller
 *
 * 路由前缀 /api/portfolio
 *   · GET    /              公开，返回已发布作品列表
 *   · GET    /:slug         公开，返回单个作品详情
 *   · GET    /admin/list     JWT，返回全部作品（含草稿/归档）
 *   · POST   /              JWT，创建作品
 *   · PUT    /reorder       JWT，批量排序
 *   · PUT    /:id           JWT，更新作品
 *   · DELETE /:id           JWT，删除作品
 *
 * 路由顺序注意：
 *   · GET  /admin/list 必须在 GET /:slug 之前声明（避免 "admin" 被当作 slug）
 *   · PUT  /reorder 必须在 PUT /:id 之前声明（避免 "reorder" 被 ParseIntPipe 当 id 解析）
 */
@ApiTags('作品集 Portfolio')
@Controller('portfolio')
export class PortfolioController {
  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly storageService: WorkCoverStorageService,
  ) {}

  /* ========== POST /api/portfolio/upload —— 管理员，上传封面图 ========== */

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @ApiOperation({ summary: '上传作品封面图（需登录，jpg/png/webp/gif ≤10MB）' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: workCoverStorage,
      limits: { fileSize: WORK_UPLOAD_MAX_SIZE },
    }),
  )
  async uploadCover(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<Result<{ url: string }>> {
    // storageService 二次校验：图片 ≤ 10MB + 格式白名单
    return Result.ok(this.storageService.upload(file), '上传成功');
  }

  /* ========== GET /api/portfolio —— 公开，列表 ========== */

  @Get()
  @ApiOperation({
    summary: '获取已发布作品列表（游客可看，1 分钟 HTTP 缓存 + Redis 缓存）',
  })
  async getPublicWorks(
    @Res({ passthrough: true }) res: Response,
  ): Promise<Result<WorkRsp[]>> {
    // 浏览器/CDN 级 HTTP 缓存：60s
    res.setHeader(
      'Cache-Control',
      `public, max-age=${REDIS_TTL.PORTFOLIO_PUBLIC}`,
    );
    res.setHeader('Vary', 'Accept');
    const data = await this.portfolioService.getPublicWorks();
    return Result.ok(data);
  }

  /* ========== GET /api/portfolio/admin/list —— 管理员，全部作品 ========== */

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('admin/list')
  @ApiOperation({ summary: '获取全部作品（含草稿/归档，admin 用）' })
  async getAdminWorks(): Promise<Result<WorkRsp[]>> {
    const data = await this.portfolioService.getAdminWorks();
    return Result.ok(data);
  }

  /* ========== 词库（分类/标签候选值）管理 —— 均为 JWT ========== */
  /* 注意：必须声明在 GET :slug / PUT :id / DELETE :id 之前，避免 "admin" 被通配解析。 */

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('admin/meta')
  @ApiOperation({ summary: '获取分类/标签词库（去重并集，admin 用）' })
  async getAdminMeta(): Promise<Result<WorkMetaRsp>> {
    const data = await this.portfolioService.getAdminMeta();
    return Result.ok(data);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('admin/meta/:kind')
  @ApiOperation({ summary: '新增词条（kind=CATEGORY|TAG，需登录）' })
  async addVocab(
    @Param('kind') kind: VocabKind,
    @Body() dto: CreateVocabDto,
  ): Promise<Result<null>> {
    await this.portfolioService.addVocab(kind, dto.name);
    return Result.ok(null, '词条已新增');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put('admin/meta/:kind')
  @ApiOperation({ summary: '重命名/合并词条（from → to，需登录）' })
  async renameVocab(
    @Param('kind') kind: VocabKind,
    @Body() dto: RenameVocabDto,
  ): Promise<Result<null>> {
    await this.portfolioService.renameVocab(kind, dto.from, dto.to);
    return Result.ok(null, '词条已更新');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('admin/meta/:kind/:name')
  @ApiOperation({ summary: '删除词条（标签会从所有作品中剥离；分类被引用时拒绝，需登录）' })
  async deleteVocab(
    @Param('kind') kind: VocabKind,
    @Param('name') name: string,
  ): Promise<Result<null>> {
    await this.portfolioService.deleteVocab(kind, decodeURIComponent(name));
    return Result.ok(null, '词条已删除');
  }

  /* ========== GET /api/portfolio/:slug —— 公开，单个详情 ========== */

  @Get(':slug')
  @ApiOperation({ summary: '按 slug 获取作品详情（游客可看，仅已发布）' })
  async getWorkBySlug(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Result<WorkRsp>> {
    res.setHeader(
      'Cache-Control',
      `public, max-age=${REDIS_TTL.PORTFOLIO_PUBLIC}`,
    );
    res.setHeader('Vary', 'Accept');
    const data = await this.portfolioService.getWorkBySlug(slug);
    return Result.ok(data);
  }

  /* ========== POST /api/portfolio —— 管理员，创建 ========== */

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: '创建作品（需登录）' })
  async createWork(@Body() dto: CreateWorkDto): Promise<Result<WorkRsp>> {
    const data = await this.portfolioService.createWork(dto);
    return Result.ok(data, '创建成功');
  }

  /* ========== PUT /api/portfolio/reorder —— 管理员，批量排序 ========== */

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put('reorder')
  @ApiOperation({ summary: '批量更新作品排序（需登录）' })
  async reorderWorks(
    @Body() dto: ReorderWorksDto,
  ): Promise<Result<null>> {
    await this.portfolioService.reorderWorks(dto.ids);
    return Result.ok(null, '排序已更新');
  }

  /* ========== PUT /api/portfolio/:id —— 管理员，更新 ========== */

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiOperation({ summary: '更新作品（需登录）' })
  async updateWork(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkDto,
  ): Promise<Result<WorkRsp>> {
    const data = await this.portfolioService.updateWork(id, dto);
    return Result.ok(data, '更新成功');
  }

  /* ========== DELETE /api/portfolio/:id —— 管理员，删除 ========== */

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: '删除作品（需登录，物理删除）' })
  async deleteWork(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Result<null>> {
    await this.portfolioService.deleteWork(id);
    return Result.ok(null, '删除成功');
  }
}
