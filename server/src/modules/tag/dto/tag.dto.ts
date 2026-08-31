import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

/** 标签 VO（含文章数） */
export interface TagVo {
  id: number;
  name: string;
  postCount: number;
  createdAt: string;
  updatedAt: string;
}

/** 创建标签 */
export class CreateTagDto {
  @ApiProperty({ example: 'Vue 3', description: '标签名称（全局唯一，1-50 字）' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  name!: string;
}

/** 更新标签（重命名） */
export class UpdateTagDto {
  @ApiPropertyOptional({ example: 'Vue 3', description: '标签名称' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  name?: string;
}

/** 合并标签 — 把当前标签合并到 targetId */
export class MergeTagDto {
  @ApiProperty({ example: 5, description: '目标标签 ID（当前标签的文章关联将转移到目标标签）' })
  @Type(() => Number)
  @IsInt()
  targetId!: number;
}
