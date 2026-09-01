import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

/* ============================================================
 *  1. 类型 & 常量
 *     · LifeStatusDto：'draft' | 'published' | 'archived'
 *       ↔ Prisma enum 大写「DRAFT | PUBLISHED | ARCHIVED」
 *     · LifeMomentTypeDto：'photo' | 'music' | 'essay' | 'footprint' | 'booknote'
 *       ↔ Prisma enum 大写「PHOTO | MUSIC | ESSAY | FOOTPRINT | BOOKNOTE」
 *     · 两个 VALUES 常量数组供 @IsIn 校验使用
 * ============================================================ */

export type LifeStatusDto = 'draft' | 'published' | 'archived';

export type LifeMomentTypeDto =
  | 'photo'
  | 'music'
  | 'essay'
  | 'footprint'
  | 'booknote';

export const LIFE_STATUS_VALUES: LifeStatusDto[] = [
  'draft',
  'published',
  'archived',
];

export const LIFE_MOMENT_TYPE_VALUES: LifeMomentTypeDto[] = [
  'photo',
  'music',
  'essay',
  'footprint',
  'booknote',
];

/* ============================================================
 *  2. CreateLifeMomentDto：创建生活碎片
 *     · 单表多态：type 决定哪些字段生效（Service 层按 type 分支校验）
 *     · date 为碎片发生日期（时间轴排序用），非 createdAt
 * ============================================================ */

export class CreateLifeMomentDto {
  @ApiProperty({
    example: 'photo',
    enum: LIFE_MOMENT_TYPE_VALUES,
    description: '碎片类型（单表多态判别字段）',
  })
  @IsString()
  @IsIn(LIFE_MOMENT_TYPE_VALUES)
  type: LifeMomentTypeDto;

  @ApiPropertyOptional({ example: '厦门日落', maxLength: 200 })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: '今天的海风很温柔……', maxLength: 10000 })
  @IsString()
  @IsOptional()
  @MaxLength(10000)
  content?: string;

  @ApiProperty({ example: '2026-09-01', description: '碎片发生日期（ISO8601）' })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiPropertyOptional({ example: '治愈', maxLength: 20 })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  mood?: string;

  @ApiPropertyOptional({ example: '/uploads/life/xxx.jpg', maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  mediaUrl?: string;

  @ApiPropertyOptional({ example: 'image/jpeg', maxLength: 50 })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  mediaType?: string;

  @ApiPropertyOptional({ example: '/uploads/life/cover.jpg', maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  thumbnailUrl?: string;

  @ApiPropertyOptional({ example: '#f59e0b', maxLength: 20 })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  gradientFrom?: string;

  @ApiPropertyOptional({ example: '#ef4444', maxLength: 20 })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  gradientTo?: string;

  @ApiPropertyOptional({ example: '#3b82f6', maxLength: 20 })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  coverColor?: string;

  @ApiPropertyOptional({ example: '坂本龙一', maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  artist?: string;

  @ApiPropertyOptional({ example: 128, description: '播放次数' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  playCount?: number;

  @ApiPropertyOptional({ example: 'https://music.163.com/xxx', maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  externalLink?: string;

  @ApiPropertyOptional({ example: '一首适合深夜听的歌', maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  comment?: string;

  @ApiPropertyOptional({ example: '村上春树', maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  bookAuthor?: string;

  @ApiPropertyOptional({ example: 5, description: '1~5 星评分', minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  @ApiPropertyOptional({ example: 'book', enum: ['book', 'movie'] })
  @IsString()
  @IsIn(['book', 'movie'])
  @IsOptional()
  bookType?: string;

  @ApiPropertyOptional({ example: 1, description: '瀑布流宽度：1=正常, 2=宽卡', minimum: 1, maximum: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2)
  @IsOptional()
  span?: number;

  @ApiPropertyOptional({ example: 'md', enum: ['sm', 'md', 'lg', 'xl'] })
  @IsString()
  @IsIn(['sm', 'md', 'lg', 'xl'])
  @IsOptional()
  heightKey?: string;

  @ApiPropertyOptional({ example: 1, description: '所属相册 id' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  albumId?: number;

  @ApiPropertyOptional({ example: 24.4798, description: '纬度（地图足迹）' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  geoLat?: number;

  @ApiPropertyOptional({ example: 118.0894, description: '经度（地图足迹）' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  geoLng?: number;

  @ApiPropertyOptional({ example: '厦门 · 鼓浪屿', maxLength: 200 })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  locationName?: string;

  @ApiPropertyOptional({ example: false, description: '是否首页精选' })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  featured?: boolean;

  @ApiPropertyOptional({ example: 'draft', enum: LIFE_STATUS_VALUES })
  @IsIn(LIFE_STATUS_VALUES)
  @IsOptional()
  status?: LifeStatusDto;
}

/* ============================================================
 *  3. UpdateLifeMomentDto：更新碎片 — 所有字段可选
 * ============================================================ */

export class UpdateLifeMomentDto extends PartialType(CreateLifeMomentDto) {}

/* ============================================================
 *  4. QueryLifeMomentDto：列表分页 + 过滤
 * ============================================================ */

export class QueryLifeMomentDto {
  @ApiPropertyOptional({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number;

  @ApiPropertyOptional({ example: 'music', enum: LIFE_MOMENT_TYPE_VALUES })
  @IsString()
  @IsIn(LIFE_MOMENT_TYPE_VALUES)
  @IsOptional()
  type?: LifeMomentTypeDto;

  @ApiPropertyOptional({ example: '治愈', maxLength: 20 })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  mood?: string;

  @ApiPropertyOptional({ example: 1, description: '相册 id' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  albumId?: number;

  @ApiPropertyOptional({ example: 'published', enum: LIFE_STATUS_VALUES })
  @IsIn(LIFE_STATUS_VALUES)
  @IsOptional()
  status?: LifeStatusDto;

  @ApiPropertyOptional({ example: true, description: '是否首页精选' })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  featured?: boolean;
}

/* ============================================================
 *  5. CreateLifeAlbumDto：创建相册
 * ============================================================ */

export class CreateLifeAlbumDto {
  @ApiProperty({ example: '厦门行 2026', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: '海边的几天', maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: '/uploads/life/album-cover.jpg' })
  @IsString()
  @IsOptional()
  coverUrl?: string;

  @ApiPropertyOptional({ example: 0, description: '排序号' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

/* ============================================================
 *  6. UpdateLifeAlbumDto：更新相册 — 所有字段可选
 * ============================================================ */

export class UpdateLifeAlbumDto extends PartialType(CreateLifeAlbumDto) {}

/* ============================================================
 *  7. 视图 VO（Service 层统一把 Prisma 实体转成这个再返回）
 *     · album：对象 { id, name }，无关联时为 null
 *     · sortOrder / featured 等都直接透传
 * ============================================================ */

export interface LifeAlbumRefVo {
  id: number;
  name: string;
}

export interface LifeMomentVo {
  id: number;
  type: LifeMomentTypeDto;
  status: LifeStatusDto;
  title: string | null;
  content: string | null;
  date: string;
  mood: string | null;
  sortOrder: number;
  featured: boolean;
  mediaUrl: string | null;
  mediaType: string | null;
  thumbnailUrl: string | null;
  gradientFrom: string | null;
  gradientTo: string | null;
  coverColor: string | null;
  artist: string | null;
  playCount: number;
  externalLink: string | null;
  comment: string | null;
  bookAuthor: string | null;
  rating: number | null;
  bookType: string | null;
  span: number;
  heightKey: string;
  albumId: number | null;
  album: LifeAlbumRefVo | null;
  geoLat: number | null;
  geoLng: number | null;
  locationName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LifeAlbumVo {
  id: number;
  name: string;
  description: string | null;
  coverUrl: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
