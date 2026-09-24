import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TimelineKind } from '@prisma/client';

/**
 * Timeline 模块 DTO 集合
 *
 *   · CreateTimelineNodeDto —— POST /api/timeline 入参（admin 新建经历）
 *   · UpdateTimelineNodeDto —— PUT  /api/timeline/:id 入参（全字段可选）
 *   · TimelineNodeRsp       —— 公开列表 / 管理列表返回结构
 *   · TimelineMetaRsp       —— GET /api/timeline/admin/meta（编辑器候选标签）
 */

/* ============================================================
 *  POST /api/timeline 入参 DTO
 * ============================================================ */

export class CreateTimelineNodeDto {
  @ApiProperty({ enum: TimelineKind, example: 'WORK', description: '节点类型' })
  @IsEnum(TimelineKind, { message: '节点类型不合法' })
  kind!: TimelineKind;

  @ApiProperty({ example: '自由开发者 · 远程协作', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ example: '独立接项目 + 产品化咨询', maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  subTitle?: string;

  @ApiProperty({ example: '2026-03', description: '开始时间（YYYY-MM）' })
  @IsString()
  @MaxLength(20)
  startedAt!: string;

  @ApiPropertyOptional({ example: '2026-05', description: '结束时间（YYYY-MM）；ongoing=true 时可留空' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  endedAt?: string;

  @ApiPropertyOptional({ example: true, description: '是否仍在进行中（显示「进行中」+「至今」）' })
  @IsOptional()
  @IsBoolean()
  ongoing?: boolean;

  @ApiProperty({ example: '专注 Vue 3 / TypeScript 方向的项目承接与顾问……' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ example: ['Vue 3', '咨询', '远程'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: true, description: '是否在公开页展示（false = 仅管理端可见）' })
  @IsOptional()
  @IsBoolean()
  visible?: boolean;
}

/* ============================================================
 *  PUT /api/timeline/:id 入参 DTO
 * ============================================================ */

/**
 * 全字段可选（PATCH 语义，Service 层只更新 dto 中出现的字段）。
 * 不继承 CreateTimelineNodeDto：后者有必填字段，Optional 继承会丢失可选语义的清晰度。
 */
export class UpdateTimelineNodeDto {
  @ApiPropertyOptional({ enum: TimelineKind })
  @IsOptional()
  @IsEnum(TimelineKind, { message: '节点类型不合法' })
  kind?: TimelineKind;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  subTitle?: string;

  @ApiPropertyOptional({ example: '2026-03' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  startedAt?: string;

  @ApiPropertyOptional({ example: '2026-05' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  endedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ongoing?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  visible?: boolean;
}

/* ============================================================
 *  响应结构
 * ============================================================ */

/** 单条经历（公开列表 / 管理列表 / 单条详情共用） */
export class TimelineNodeRsp {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ enum: TimelineKind, example: 'WORK' })
  kind!: TimelineKind;

  @ApiProperty({ example: '自由开发者 · 远程协作' })
  title!: string;

  @ApiProperty({ example: '独立接项目 + 产品化咨询' })
  subTitle!: string;

  @ApiProperty({ example: '2026-03' })
  startedAt!: string;

  @ApiProperty({ example: '2026-05' })
  endedAt!: string;

  @ApiProperty({ example: true })
  ongoing!: boolean;

  @ApiProperty({ example: '专注 Vue 3 / TypeScript 方向……' })
  description!: string;

  @ApiProperty({ example: ['Vue 3', '咨询'], type: [String] })
  tags!: string[];

  @ApiProperty({ example: true, description: '是否在公开页展示' })
  visible!: boolean;

  @ApiProperty({ example: '2026-09-24T02:00:00.000Z' })
  updatedAt!: string;
}

/** GET /api/timeline/admin/meta 返回：编辑器候选标签（去重、按出现次数降序） */
export class TimelineMetaRsp {
  @ApiProperty({ example: ['Vue 3', '开源', '咨询'], type: [String] })
  tags!: string[];
}
