import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export type PostStatus = 'draft' | 'published' | 'archived';

export class CreatePostDto {
  @ApiProperty({ example: 'NestJS 入门实战' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: '摘要内容……', required: false })
  @IsString()
  @IsOptional()
  summary?: string;

  @ApiProperty({ example: '# Hello', description: 'Markdown 正文' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ example: '工程笔记', required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ example: ['NestJS', 'TypeScript'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({
    example: 'draft',
    enum: ['draft', 'published', 'archived'],
    required: false,
  })
  @IsIn(['draft', 'published', 'archived'])
  @IsOptional()
  status?: PostStatus;
}

export class UpdatePostDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  summary?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({
    enum: ['draft', 'published', 'archived'],
    required: false,
  })
  @IsIn(['draft', 'published', 'archived'])
  @IsOptional()
  status?: PostStatus;
}

export class QueryPostDto {
  @ApiProperty({ example: 1, required: false })
  @IsInt()
  @IsOptional()
  page?: number;

  @ApiProperty({ example: 10, required: false })
  @IsInt()
  @IsOptional()
  pageSize?: number;

  @ApiProperty({ example: 'NestJS', required: false })
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiProperty({ example: '工程笔记', required: false })
  @IsString()
  @IsOptional()
  category?: string;
}

/**
 * 文章视图对象（骨架）
 */
export interface PostVo {
  id: number;
  slug: string;
  title: string;
  summary?: string;
  content?: string;
  category?: string;
  tags: string[];
  status: PostStatus;
  wordCount: number;
  readMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface PostPageVo {
  list: PostVo[];
  total: number;
  page: number;
  pageSize: number;
}
