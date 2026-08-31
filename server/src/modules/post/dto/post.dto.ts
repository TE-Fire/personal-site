import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostStatus as PrismaPostStatus } from '@prisma/client';

/* ============================================================
 *  1. Status：前后端用小写字符串「draft | published | archived」
 *             ↔ Prisma enum 大写「DRAFT | PUBLISHED | ARCHIVED」
 *             通过两个 helper 双向映射，DTO 层永远吃小写。
 * ============================================================ */

export type PostStatusDto = 'draft' | 'published' | 'archived';

export const POST_STATUS_VALUES: PostStatusDto[] = [
  'draft',
  'published',
  'archived',
];

const STATUS_MAP_DTO_TO_PRISMA: Record<PostStatusDto, PrismaPostStatus> = {
  draft: PrismaPostStatus.DRAFT,
  published: PrismaPostStatus.PUBLISHED,
  archived: PrismaPostStatus.ARCHIVED,
};

const STATUS_MAP_PRISMA_TO_DTO: Record<PrismaPostStatus, PostStatusDto> = {
  [PrismaPostStatus.DRAFT]: 'draft',
  [PrismaPostStatus.PUBLISHED]: 'published',
  [PrismaPostStatus.ARCHIVED]: 'archived',
};

export function toPrismaStatus(s?: PostStatusDto): PrismaPostStatus | undefined {
  return s ? STATUS_MAP_DTO_TO_PRISMA[s] : undefined;
}

export function toDtoStatus(s: PrismaPostStatus): PostStatusDto {
  return STATUS_MAP_PRISMA_TO_DTO[s];
}

/* ============================================================
 *  2. CreatePostDto：创建文章
 *     · 正文 wordCount / readMinutes 由服务端 calcMetrics() 计算，
 *       DTO 层没有这两个字段（防止客户端伪造）。
 *     · tags 传的是 Int[] 主键 — Service 层对未存在的 tag 用
 *       prisma.tag.upsert/connectOrCreate 落库再关联。
 * ============================================================ */

export class CreatePostDto {
  @ApiProperty({ example: 'hello-world', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  slug: string;

  @ApiProperty({ example: 'NestJS 入门实战', maxLength: 300 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 300)
  title: string;

  @ApiPropertyOptional({ example: '这是摘要，不超过 500 字', maxLength: 500 })
  @IsString()
  @IsOptional()
  @Length(0, 500)
  excerpt?: string;

  @ApiProperty({ example: '# Hello\n正文……', description: 'Markdown 正文字符串' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    example: '/uploads/covers/nestjs-intro.jpg',
    description:
      '封面图片地址（普通 URL 或 base64 DataURL 皆可；DataURL 用于本地上传预览，长度放宽到 8,000,000 字符≈支持 6MB 级图片）',
    maxLength: 8_000_000,
  })
  @IsString()
  @IsOptional()
  @Length(0, 8_000_000)
  cover?: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  featured?: boolean;

  @ApiPropertyOptional({
    example: 'draft',
    enum: POST_STATUS_VALUES,
  })
  @IsIn(POST_STATUS_VALUES)
  @IsOptional()
  status?: PostStatusDto;

  @ApiPropertyOptional({ example: 1, description: 'category.id（严格模型外键）' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  categoryId?: number;

  @ApiPropertyOptional({
    example: [1, 2, 3],
    type: [Number],
    description: 'tag.id 数组（严格模型，通过中间表 PostTag 关联）',
  })
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @IsOptional()
  tagIds?: number[];
}

/* ============================================================
 *  3. UpdatePostDto：更新文章 — 所有字段可选
 *     · tagIds 传的是全量数组（Service 层 deleteMany 旧关联 +
 *       create 新关联，相当于 replace）。
 * ============================================================ */

export class UpdatePostDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsString()
  @IsOptional()
  @Length(1, 200)
  slug?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsString()
  @IsOptional()
  @Length(1, 300)
  title?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsString()
  @IsOptional()
  @Length(0, 500)
  excerpt?: string;

  @ApiPropertyOptional({ description: 'Markdown 正文字符串' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({
    maxLength: 8_000_000,
    description: '同 CreatePostDto.cover，支持 URL / DataURL',
  })
  @IsString()
  @IsOptional()
  @Length(0, 8_000_000)
  cover?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  featured?: boolean;

  @ApiPropertyOptional({ enum: POST_STATUS_VALUES })
  @IsIn(POST_STATUS_VALUES)
  @IsOptional()
  status?: PostStatusDto;

  @ApiPropertyOptional({ description: '传 null 表示清空分类' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  categoryId?: number | null;

  @ApiPropertyOptional({ type: [Number], description: 'tag.id 全量数组（replace 策略）' })
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @IsOptional()
  tagIds?: number[];
}

/* ============================================================
 *  4. QueryPostDto：列表分页 + 过滤
 *     · keyword：LIKE (title OR excerpt)
 *     · categoryId：精确匹配
 *     · status：仅 admin 查询传 'draft'/'archived'，公开接口默认
 *       Service 层硬塞 status='published'
 *     · featured / tags[]：额外过滤
 * ============================================================ */

export class QueryPostDto {
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

  @ApiPropertyOptional({ example: 'NestJS' })
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiPropertyOptional({ example: 1, description: 'category.id' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  categoryId?: number;

  @ApiPropertyOptional({ enum: POST_STATUS_VALUES })
  @IsIn(POST_STATUS_VALUES)
  @IsOptional()
  status?: PostStatusDto;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  featured?: boolean;

  @ApiPropertyOptional({ type: [Number], description: 'tag.id 数组（命中任一即可）' })
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @IsOptional()
  tagIds?: number[];
}

/* ============================================================
 *  5. 视图 VO（Service 层统一把 Prisma 实体转成这个再返回）
 *     · category：对象 { id, name, sort }，不单独 categoryName
 *     · tags：对象数组 { id, name }，不单独 tagNames[]
 *     · 列表接口 content 为 undefined（详情接口才返回 Markdown）
 * ============================================================ */

export interface CategoryRefVo {
  id: number;
  name: string;
  sort: number;
}

export interface TagRefVo {
  id: number;
  name: string;
}

export interface AuthorRefVo {
  id: number;
  nickname: string;
  avatar: string | null;
}

export interface PostVo {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  /** 列表接口为 undefined，详情接口为 Markdown 原文 */
  content?: string;
  cover: string | null;
  featured: boolean;
  status: PostStatusDto;
  wordCount: number;
  readMinutes: number;
  category: CategoryRefVo | null;
  tags: TagRefVo[];
  author: AuthorRefVo;
  createdAt: string;
  updatedAt: string;
}

export interface PostPageVo {
  list: PostVo[];
  total: number;
  page: number;
  pageSize: number;
}

/* ============================================================
 *  6. Service 共用 helper：根据 Markdown 正文算指标
 * ============================================================ */

/**
 * 根据 Markdown 正文计算字数 + 阅读时长（每分钟 500 字）。
 * 字数：粗略 = 字符数。纯中文一篇 5000 字 ≈ 10 分钟，合理。
 */
export function calcMetrics(content: string): {
  wordCount: number;
  readMinutes: number;
} {
  const wordCount = content?.length ?? 0;
  const readMinutes = Math.max(1, Math.ceil(wordCount / 500));
  return { wordCount, readMinutes };
}
