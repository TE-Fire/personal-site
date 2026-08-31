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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PostService } from './post.service';
import {
  CreatePostDto,
  PostPageVo,
  PostVo,
  QueryPostDto,
  UpdatePostDto,
} from './dto/post.dto';
import { Result } from '@/common/result';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

/**
 * Post Controller — 遵循 NestJS-Architecture-Guide.md §3.2 ②
 *
 * 路由前缀 /api/posts，与其他模块风格统一。
 *
 * 权限设计（遵循文档 4.8 权限守卫设计）：
 *   · GET 列表/详情 → OptionalJwtAuthGuard（游客可访问，博主可看草稿）
 *   · POST/PUT/DELETE → JwtAuthGuard（强制登录）
 */
@ApiTags('文章 Post')
@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  /** 判断请求者是否为博主（admin） */
  private isAdmin(req: Request): boolean {
    return (req.user as { id: number; role: string } | undefined)?.role === 'admin';
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '查询文章列表（公开，游客只看已发布）' })
  async query(@Query() dto: QueryPostDto, @Req() req: Request): Promise<Result<PostPageVo>> {
    // 游客（非 admin）且未指定 status → 强制只看 published
    if (!this.isAdmin(req) && !dto.status) {
      dto.status = 'published';
    }
    return Result.ok(await this.postService.query(dto));
  }

  @Get('slug/:slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '按 slug 查询文章详情（公开，游客只能看已发布）' })
  async findBySlug(
    @Param('slug') slug: string,
    @Req() req: Request,
  ): Promise<Result<PostVo>> {
    return Result.ok(await this.postService.findBySlug(slug, !this.isAdmin(req)));
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '按 id 查询文章详情（公开，游客只能看已发布）' })
  async findById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ): Promise<Result<PostVo>> {
    return Result.ok(await this.postService.findById(id, !this.isAdmin(req)));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: '新建文章（需登录）' })
  async create(@Body() dto: CreatePostDto, @Req() req: Request): Promise<Result<PostVo>> {
    const authorId = (req.user as { id: number }).id;
    return Result.ok(await this.postService.create(dto, authorId), '创建成功');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiOperation({ summary: '更新文章（需登录）' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
  ): Promise<Result<PostVo>> {
    return Result.ok(await this.postService.update(id, dto), '更新成功');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: '删除文章（需登录，默认软删除→归档）' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('hard') hard?: string,
  ): Promise<Result<null>> {
    await this.postService.remove(id, hard === 'true');
    return Result.ok(null, hard === 'true' ? '已物理删除' : '已归档');
  }
}
