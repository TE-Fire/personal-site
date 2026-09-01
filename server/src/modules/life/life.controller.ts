import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Result } from '@/common/result';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { LifeService } from './life.service';
import { LocalStorageService } from './storage.service';
import {
  CreateLifeMomentDto,
  UpdateLifeMomentDto,
  QueryLifeMomentDto,
  CreateLifeAlbumDto,
  UpdateLifeAlbumDto,
  LifeMomentVo,
  LifeAlbumVo,
} from './dto/life.dto';

/* ---------- Life 上传 Multer 配置 ---------- */
const LIFE_UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'life');
const LIFE_UPLOAD_MAX_SIZE = 30 * 1024 * 1024; // 30MB（音频上限；图片由 storageService 二次校验到 10MB）

const lifeStorage = diskStorage({
  destination: (_req, _file, cb) => {
    // 启动时自动创建目录（如果不存在）
    if (!existsSync(LIFE_UPLOAD_DIR)) {
      mkdirSync(LIFE_UPLOAD_DIR, { recursive: true });
    }
    cb(null, LIFE_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const ext = extname(file.originalname).toLowerCase() || '.bin';
    cb(null, `${stamp}-${rand}${ext}`);
  },
});

/** 上传响应体 */
interface LifeUploadRsp {
  url: string;
  mimeType: string;
}

/** 分页列表响应体 */
interface LifeMomentPageVo {
  list: LifeMomentVo[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Life Controller — 生活碎片 + 相册
 *
 * 路由前缀 /api/life
 *
 * 权限设计（同 Post）：
 *   · GET 列表/详情/相册 → OptionalJwtAuthGuard（游客可访问，博主可看草稿）
 *   · POST/PUT/DELETE/upload → JwtAuthGuard（强制登录）
 *
 * 路由顺序注意：
 *   · GET /albums 必须在 GET /:id 之前声明，否则 "albums" 会被 ParseIntPipe 当 id 解析
 */
@ApiTags('生活碎片 Life')
@Controller('life')
export class LifeController {
  constructor(
    private readonly lifeService: LifeService,
    private readonly storageService: LocalStorageService,
  ) {}

  /** 判断请求者是否为博主（admin） */
  private isAdmin(req: Request): boolean {
    return (
      (req.user as { id: number; role: string } | undefined)?.role === 'admin'
    );
  }

  /* ==================== 碎片路由 ==================== */

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '查询生活碎片列表（公开，游客只看已发布）' })
  async query(
    @Query() dto: QueryLifeMomentDto,
    @Req() req: Request,
  ): Promise<Result<LifeMomentPageVo>> {
    // 游客（非 admin）且未指定 status → 强制只看 published
    if (!this.isAdmin(req) && !dto.status) {
      dto.status = 'published';
    }
    return Result.ok(await this.lifeService.query(dto));
  }

  @Get('albums')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '查询全部相册（公开）' })
  async queryAlbums(): Promise<Result<LifeAlbumVo[]>> {
    return Result.ok(await this.lifeService.queryAlbums());
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '按 id 查询碎片详情（公开，游客只能看已发布）' })
  async findById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ): Promise<Result<LifeMomentVo>> {
    return Result.ok(await this.lifeService.findById(id, !this.isAdmin(req)));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: '新建生活碎片（需登录）' })
  async create(
    @Body() dto: CreateLifeMomentDto,
    @Req() req: Request,
  ): Promise<Result<LifeMomentVo>> {
    const authorId = (req.user as { id: number }).id;
    return Result.ok(await this.lifeService.create(dto, authorId), '创建成功');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @ApiOperation({ summary: '上传生活碎片媒体文件（图片/音频，需登录）' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: lifeStorage,
      limits: { fileSize: LIFE_UPLOAD_MAX_SIZE },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<Result<LifeUploadRsp>> {
    // storageService 二次校验：图片 ≤ 10MB，音频 ≤ 30MB，格式白名单
    return Result.ok(this.storageService.upload(file), '上传成功');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('albums')
  @ApiOperation({ summary: '创建相册（需登录）' })
  async createAlbum(
    @Body() dto: CreateLifeAlbumDto,
  ): Promise<Result<LifeAlbumVo>> {
    return Result.ok(await this.lifeService.createAlbum(dto), '创建成功');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiOperation({ summary: '更新生活碎片（需登录）' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLifeMomentDto,
  ): Promise<Result<LifeMomentVo>> {
    return Result.ok(await this.lifeService.update(id, dto), '更新成功');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put('albums/:id')
  @ApiOperation({ summary: '更新相册（需登录）' })
  async updateAlbum(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLifeAlbumDto,
  ): Promise<Result<LifeAlbumVo>> {
    return Result.ok(await this.lifeService.updateAlbum(id, dto), '更新成功');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: '删除生活碎片（需登录，默认软删除→归档）' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('hard') hard?: string,
  ): Promise<Result<null>> {
    await this.lifeService.remove(id, hard === 'true');
    return Result.ok(null, hard === 'true' ? '已物理删除' : '已归档');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('albums/:id')
  @ApiOperation({ summary: '删除相册（需登录，物理删除）' })
  async removeAlbum(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Result<null>> {
    await this.lifeService.removeAlbum(id);
    return Result.ok(null, '相册已删除');
  }
}
