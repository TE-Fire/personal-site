import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

/** 分类 VO（含文章数） */
export interface CategoryVo {
  id: number;
  name: string;
  sort: number;
  postCount: number;
  createdAt: string;
  updatedAt: string;
}

/** 创建分类 */
export class CreateCategoryDto {
  @ApiProperty({ example: '工程笔记', description: '分类名称（全局唯一，1-50 字）' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  name!: string;

  @ApiPropertyOptional({ example: 0, description: '排序号（ASC，默认 0）' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  sort?: number;
}

/** 更新分类 */
export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: '工程笔记', description: '分类名称' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 1, description: '排序号' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  sort?: number;
}
