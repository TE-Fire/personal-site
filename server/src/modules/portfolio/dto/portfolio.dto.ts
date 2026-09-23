import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/* ============================================================
 *  1. 发布状态枚举（与 Prisma WorkStatus 值一致：DRAFT / PUBLISHED / ARCHIVED）
 * ============================================================ */

enum WorkStatusEnum {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

/** 作品链接对象类型 */
export interface WorkLinks {
  homepage?: string;
  repo?: string;
  demo?: string;
  /** 索引签名：兼容 Prisma InputJsonObject（JSON 字段写入需要） */
  [key: string]: string | undefined;
}

/* ============================================================
 *  2. CreateWorkDto：创建作品
 * ============================================================ */

export class CreateWorkDto {
  @ApiProperty({ example: 'p-personal-site-2026', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  slug: string;

  @ApiProperty({ example: '个人作品集（本站）', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'Vue 3 + Vite + Tailwind…', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @ApiProperty({ example: '完整实践了从需求拆解 → 方案文档…' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ example: 'from-brand/30 via-accent/30 to-chart-c1/30', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cover?: string;

  @ApiProperty({ example: ['Vue 3', 'Tailwind', 'Vite'], description: '技术标签数组' })
  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @ApiPropertyOptional({ example: '独立项目', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional({
    example: { homepage: 'https://example.com', repo: 'https://github.com/xxx' },
    description: '作品链接（homepage / repo / demo）',
  })
  @IsOptional()
  @IsObject()
  links?: WorkLinks;

  @ApiPropertyOptional({ example: '2026-08', maxLength: 20, description: '完成时间（YYYY-MM 格式）' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  finishedAt?: string;

  @ApiPropertyOptional({ example: true, description: '是否精选（首页/列表高亮）' })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  highlight?: boolean;

  @ApiPropertyOptional({ example: 0, minimum: 0, description: '排序号（越小越靠前）' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ example: 'PUBLISHED', enum: WorkStatusEnum })
  @IsOptional()
  @IsEnum(WorkStatusEnum)
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

/* ============================================================
 *  3. UpdateWorkDto：更新作品 — 结构同 CreateWorkDto
 * ============================================================ */

export class UpdateWorkDto extends CreateWorkDto {}

/* ============================================================
 *  4. 批量排序 DTO
 * ============================================================ */

export class ReorderWorksDto {
  @ApiProperty({ example: [3, 1, 2], description: '按新顺序排列的作品 id 数组' })
  @IsArray()
  @IsInt({ each: true })
  ids: number[];
}

/* ============================================================
 *  5. 响应 VO（Service 层统一把 Prisma 实体转成这个再返回）
 * ============================================================ */

export class WorkRsp {
  id: number;
  slug: string;
  title: string;
  summary: string;
  description: string;
  cover: string;
  tags: string[];
  category: string;
  links: WorkLinks;
  finishedAt: string;
  highlight: boolean;
  sortOrder: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}
