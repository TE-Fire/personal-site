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
import { CategoryService } from './category.service';
import {
  CategoryVo,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/category.dto';
import { Result } from '@/common/result';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Category Controller — 遵循 NestJS-Architecture-Guide.md §3.2 ②
 *
 * 路由前缀 /api/categories
 *
 * 权限设计：
 *   · GET 列表 → 公开（游客可读）
 *   · POST/PUT/DELETE → JwtAuthGuard（强制登录）
 */
@ApiTags('分类 Category')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({ summary: '查询全部分类（公开，含文章数）' })
  async findAll(): Promise<Result<CategoryVo[]>> {
    return Result.ok(await this.categoryService.findAll());
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: '创建分类（需登录）' })
  async create(
    @Body() dto: CreateCategoryDto,
    @Req() req: Request,
  ): Promise<Result<CategoryVo>> {
    const authorId = (req.user as { id: number }).id;
    return Result.ok(await this.categoryService.create(dto, authorId), '创建成功');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiOperation({ summary: '更新分类（需登录）' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ): Promise<Result<CategoryVo>> {
    return Result.ok(await this.categoryService.update(id, dto), '更新成功');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: '删除分类（需登录，文章分类自动置空）' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<Result<null>> {
    await this.categoryService.remove(id);
    return Result.ok(null, '删除成功，关联文章分类已置空');
  }
}
