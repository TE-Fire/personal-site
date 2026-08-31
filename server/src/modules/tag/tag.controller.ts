import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { TagService } from './tag.service';
import {
  TagVo,
  CreateTagDto,
  UpdateTagDto,
  MergeTagDto,
} from './dto/tag.dto';
import { Result } from '@/common/result';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Tag Controller — 遵循 NestJS-Architecture-Guide.md §3.2 ②
 *
 * 路由前缀 /api/tags
 *
 * 权限设计：
 *   · GET 列表 → 公开（游客可读）
 *   · POST/PUT/DELETE/merge → JwtAuthGuard（强制登录）
 */
@ApiTags('标签 Tag')
@Controller('tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get()
  @ApiOperation({ summary: '查询全部标签（公开，含文章数，按文章数降序）' })
  async findAll(): Promise<Result<TagVo[]>> {
    return Result.ok(await this.tagService.findAll());
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: '创建标签（需登录）' })
  async create(@Body() dto: CreateTagDto): Promise<Result<TagVo>> {
    return Result.ok(await this.tagService.create(dto), '创建成功');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiOperation({ summary: '重命名标签（需登录）' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTagDto,
  ): Promise<Result<TagVo>> {
    return Result.ok(await this.tagService.update(id, dto), '重命名成功');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: '删除标签（需登录，同时删除文章关联）' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<Result<null>> {
    await this.tagService.remove(id);
    return Result.ok(null, '删除成功，文章关联已清除');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/merge')
  @ApiOperation({ summary: '合并标签（需登录，把当前标签合并到目标标签）' })
  async merge(
    @Param('id', ParseIntPipe) sourceId: number,
    @Body() dto: MergeTagDto,
  ): Promise<Result<{ affectedPosts: number }>> {
    const affectedPosts = await this.tagService.merge(sourceId, dto);
    return Result.ok({ affectedPosts }, `合并完成，${affectedPosts} 篇文章已转移`);
  }
}
