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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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

/**
 * Post Controller：
 *   GET /posts       列表（公开）
 *   GET /posts/:id   详情（公开）
 *   POST /posts      新建（需登录）
 *   PUT /posts/:id   更新（需登录）
 *   DELETE /posts/:id 删除（需登录）
 */
@ApiTags('文章 Post')
@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get()
  @ApiOperation({ summary: '查询文章列表（公开）' })
  async query(@Query() dto: QueryPostDto): Promise<Result<PostPageVo>> {
    return Result.ok(await this.postService.query(dto));
  }

  @Get(':id')
  @ApiOperation({ summary: '查询文章详情（公开）' })
  async findById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Result<PostVo>> {
    return Result.ok(await this.postService.findById(id));
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: '按 slug 查询文章详情（公开）' })
  async findBySlug(@Param('slug') slug: string): Promise<Result<PostVo>> {
    return Result.ok(await this.postService.findBySlug(slug));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: '新建文章' })
  async create(@Body() dto: CreatePostDto): Promise<Result<PostVo>> {
    return Result.ok(await this.postService.create(dto), '创建成功');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiOperation({ summary: '更新文章' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
  ): Promise<Result<PostVo>> {
    return Result.ok(await this.postService.update(id, dto), '更新成功');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: '删除文章' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Result<null>> {
    await this.postService.remove(id);
    return Result.ok(null, '删除成功');
  }
}
