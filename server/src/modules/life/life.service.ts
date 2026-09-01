import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  LifeMomentType as PrismaLifeMomentType,
  LifeStatus as PrismaLifeStatus,
} from '@prisma/client';
import { PrismaService } from '@/common/prisma.service';
import { BusinessException } from '@/common/exception';
import { LifeBizError } from './enums/life-biz-error.enum';
import { LocalStorageService } from './storage.service';
import {
  CreateLifeMomentDto,
  UpdateLifeMomentDto,
  QueryLifeMomentDto,
  CreateLifeAlbumDto,
  UpdateLifeAlbumDto,
  LifeMomentVo,
  LifeAlbumVo,
  LifeMomentTypeDto,
  LifeStatusDto,
} from './dto/life.dto';

/* ============================================================
 *  DTO 小写字符串 ↔ Prisma 大写 enum 映射
 *  · LifeMomentTypeDto：'photo' | 'music' | 'essay' | 'footprint' | 'booknote'
 *    ↔ PrismaLifeMomentType：PHOTO | MUSIC | ESSAY | FOOTPRINT | BOOKNOTE
 *  · LifeStatusDto：'draft' | 'published' | 'archived'
 *    ↔ PrismaLifeStatus：DRAFT | PUBLISHED | ARCHIVED
 * ============================================================ */

const TYPE_MAP_DTO_TO_PRISMA: Record<LifeMomentTypeDto, PrismaLifeMomentType> = {
  photo: PrismaLifeMomentType.PHOTO,
  music: PrismaLifeMomentType.MUSIC,
  essay: PrismaLifeMomentType.ESSAY,
  footprint: PrismaLifeMomentType.FOOTPRINT,
  booknote: PrismaLifeMomentType.BOOKNOTE,
};

const TYPE_MAP_PRISMA_TO_DTO: Record<PrismaLifeMomentType, LifeMomentTypeDto> = {
  [PrismaLifeMomentType.PHOTO]: 'photo',
  [PrismaLifeMomentType.MUSIC]: 'music',
  [PrismaLifeMomentType.ESSAY]: 'essay',
  [PrismaLifeMomentType.FOOTPRINT]: 'footprint',
  [PrismaLifeMomentType.BOOKNOTE]: 'booknote',
};

const STATUS_MAP_DTO_TO_PRISMA: Record<LifeStatusDto, PrismaLifeStatus> = {
  draft: PrismaLifeStatus.DRAFT,
  published: PrismaLifeStatus.PUBLISHED,
  archived: PrismaLifeStatus.ARCHIVED,
};

const STATUS_MAP_PRISMA_TO_DTO: Record<PrismaLifeStatus, LifeStatusDto> = {
  [PrismaLifeStatus.DRAFT]: 'draft',
  [PrismaLifeStatus.PUBLISHED]: 'published',
  [PrismaLifeStatus.ARCHIVED]: 'archived',
};

/** DTO 小写 → Prisma 大写（undefined 透传） */
export function toPrismaType(
  t?: LifeMomentTypeDto,
): PrismaLifeMomentType | undefined {
  return t ? TYPE_MAP_DTO_TO_PRISMA[t] : undefined;
}

/** DTO 小写 → Prisma 大写（undefined 透传） */
export function toPrismaStatus(
  s?: LifeStatusDto,
): PrismaLifeStatus | undefined {
  return s ? STATUS_MAP_DTO_TO_PRISMA[s] : undefined;
}

/** Prisma 大写 → DTO 小写 */
function toDtoType(t: PrismaLifeMomentType): LifeMomentTypeDto {
  return TYPE_MAP_PRISMA_TO_DTO[t];
}

/** Prisma 大写 → DTO 小写 */
function toDtoStatus(s: PrismaLifeStatus): LifeStatusDto {
  return STATUS_MAP_PRISMA_TO_DTO[s];
}

/* ============================================================
 *  Prisma 查询常量
 * ============================================================ */

/** LifeMoment 关联查询的 include 常量（列表 + 详情共用） */
const LIFE_MOMENT_INCLUDE = {
  album: { select: { id: true, name: true } },
} satisfies Prisma.LifeMomentInclude;

/** LifeAlbum 查询的 select 常量（取全部标量字段） */
const LIFE_ALBUM_SELECT = {
  id: true,
  name: true,
  description: true,
  coverUrl: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LifeAlbumSelect;

type LifeMomentPayload = Prisma.LifeMomentGetPayload<{
  include: typeof LIFE_MOMENT_INCLUDE;
}>;
type LifeAlbumPayload = Prisma.LifeAlbumGetPayload<{
  select: typeof LIFE_ALBUM_SELECT;
}>;

/**
 * Life Service — 生活碎片 + 相册 CRUD
 *
 * 遵循 NestJS-Architecture-Guide.md 分层架构：
 *   Controller → Service → Prisma（不抽 Repository）
 *
 * 与 Post 模块差异：
 *   · 不做 Redis 缓存（Life 数据量小，直接查 DB）
 *   · 不做 singleflight（并发量低，无需防击穿）
 *   · LifeMoment 无 author 关联（博主单人运营，不需要作者维度）
 *   · 单表多态：type 字段决定 PHOTO/MUSIC/ESSAY/FOOTPRINT/BOOKNOTE
 *
 * 软删除策略（同 Post）：
 *   · remove(hard=false) → status = ARCHIVED
 *   · remove(hard=true) → prisma.lifeMoment.delete（物理删除）
 */
@Injectable()
export class LifeService {
  private readonly logger = new Logger(LifeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: LocalStorageService,
  ) {}

  /* ==================== 碎片查询 ==================== */

  /**
   * 分页查询生活碎片列表
   * @param dto 查询条件 + 分页（游客的 status 由 Controller 强制塞 'published'）
   */
  async query(dto: QueryLifeMomentDto): Promise<{
    list: LifeMomentVo[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 10;

    const where: Prisma.LifeMomentWhereInput = {};

    if (dto.type) {
      const t = toPrismaType(dto.type);
      if (t) where.type = t;
    }
    if (dto.mood) {
      where.mood = dto.mood;
    }
    if (dto.albumId) {
      where.albumId = dto.albumId;
    }
    if (dto.status) {
      // 显式指定 status → 用指定值（admin 可以用 archived/draft）
      const s = toPrismaStatus(dto.status);
      if (s) where.status = s;
    } else {
      // 没指定 → 默认只查 PUBLISHED（ARCHIVED 对所有人隐藏）
      where.status = PrismaLifeStatus.PUBLISHED;
    }
    if (dto.featured !== undefined) {
      where.featured = dto.featured;
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.lifeMoment.findMany({
        where,
        include: LIFE_MOMENT_INCLUDE,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ date: 'desc' }, { sortOrder: 'desc' }],
      }),
      this.prisma.lifeMoment.count({ where }),
    ]);

    return {
      list: rows.map((r) => this.toMomentVo(r)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 按 id 查碎片详情
   * @param publicOnly true = 游客模式（只有 PUBLISHED 可见）
   * @description     ARCHIVED 对所有人隐藏（软删除即不可见）；
   *                  DRAFT 仅 admin（publicOnly=false）可见。
   */
  async findById(id: number, publicOnly: boolean): Promise<LifeMomentVo> {
    const moment = await this.prisma.lifeMoment.findUnique({
      where: { id },
      include: LIFE_MOMENT_INCLUDE,
    });
    if (!moment) {
      throw new BusinessException(LifeBizError.NOT_FOUND);
    }
    // ARCHIVED 对任何人都不可访问（已软删除）
    if (moment.status === PrismaLifeStatus.ARCHIVED) {
      throw new BusinessException(LifeBizError.NOT_FOUND);
    }
    // 游客只能看 PUBLISHED，admin 还能看 DRAFT
    if (publicOnly && moment.status !== PrismaLifeStatus.PUBLISHED) {
      throw new BusinessException(LifeBizError.NOT_FOUND);
    }
    return this.toMomentVo(moment);
  }

  /* ==================== 碎片写入 ==================== */

  /**
   * 创建生活碎片
   * @param dto       CreateLifeMomentDto
   * @param authorId  从 JWT req.user.id 注入（schema 无 author 字段，预留参数）
   */
  async create(
    dto: CreateLifeMomentDto,
    _authorId: number,
  ): Promise<LifeMomentVo> {
    if (dto.albumId) {
      await this.validateAlbum(dto.albumId);
    }

    const data: Prisma.LifeMomentCreateInput = {
      type: toPrismaType(dto.type)!,
      status: toPrismaStatus(dto.status) ?? PrismaLifeStatus.PUBLISHED,
      title: dto.title,
      content: dto.content,
      date: new Date(dto.date),
      mood: dto.mood,
      mediaUrl: dto.mediaUrl,
      mediaType: dto.mediaType,
      thumbnailUrl: dto.thumbnailUrl,
      gradientFrom: dto.gradientFrom,
      gradientTo: dto.gradientTo,
      coverColor: dto.coverColor,
      artist: dto.artist,
      playCount: dto.playCount,
      externalLink: dto.externalLink,
      comment: dto.comment,
      bookAuthor: dto.bookAuthor,
      rating: dto.rating,
      bookType: dto.bookType,
      span: dto.span,
      heightKey: dto.heightKey,
      featured: dto.featured,
      geoLat: dto.geoLat,
      geoLng: dto.geoLng,
      locationName: dto.locationName,
    };

    if (dto.albumId) {
      data.album = { connect: { id: dto.albumId } };
    }

    const moment = await this.prisma.lifeMoment.create({
      data,
      include: LIFE_MOMENT_INCLUDE,
    });
    return this.toMomentVo(moment);
  }

  /**
   * 更新生活碎片
   * - albumId 传 number = connect；undefined = 不改
   * - date 传了 → new Date(isoString)
   */
  async update(id: number, dto: UpdateLifeMomentDto): Promise<LifeMomentVo> {
    const existing = await this.prisma.lifeMoment.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new BusinessException(LifeBizError.NOT_FOUND);
    }

    if (dto.albumId !== undefined && dto.albumId !== null) {
      await this.validateAlbum(dto.albumId);
    }

    const data: Prisma.LifeMomentUpdateInput = {};
    if (dto.type !== undefined) {
      const t = toPrismaType(dto.type);
      if (t) data.type = t;
    }
    if (dto.status !== undefined) {
      const s = toPrismaStatus(dto.status);
      if (s) data.status = s;
    }
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.date !== undefined) data.date = new Date(dto.date);
    if (dto.mood !== undefined) data.mood = dto.mood;
    if (dto.mediaUrl !== undefined) data.mediaUrl = dto.mediaUrl;
    if (dto.mediaType !== undefined) data.mediaType = dto.mediaType;
    if (dto.thumbnailUrl !== undefined) data.thumbnailUrl = dto.thumbnailUrl;
    if (dto.gradientFrom !== undefined) data.gradientFrom = dto.gradientFrom;
    if (dto.gradientTo !== undefined) data.gradientTo = dto.gradientTo;
    if (dto.coverColor !== undefined) data.coverColor = dto.coverColor;
    if (dto.artist !== undefined) data.artist = dto.artist;
    if (dto.playCount !== undefined) data.playCount = dto.playCount;
    if (dto.externalLink !== undefined) data.externalLink = dto.externalLink;
    if (dto.comment !== undefined) data.comment = dto.comment;
    if (dto.bookAuthor !== undefined) data.bookAuthor = dto.bookAuthor;
    if (dto.rating !== undefined) data.rating = dto.rating;
    if (dto.bookType !== undefined) data.bookType = dto.bookType;
    if (dto.span !== undefined) data.span = dto.span;
    if (dto.heightKey !== undefined) data.heightKey = dto.heightKey;
    if (dto.featured !== undefined) data.featured = dto.featured;
    if (dto.geoLat !== undefined) data.geoLat = dto.geoLat;
    if (dto.geoLng !== undefined) data.geoLng = dto.geoLng;
    if (dto.locationName !== undefined) data.locationName = dto.locationName;
    // albumId: number = connect, null = disconnect, undefined = 不改
    if (dto.albumId === null) {
      data.album = { disconnect: true };
    } else if (dto.albumId !== undefined) {
      data.album = { connect: { id: dto.albumId } };
    }

    const moment = await this.prisma.lifeMoment.update({
      where: { id },
      data,
      include: LIFE_MOMENT_INCLUDE,
    });
    return this.toMomentVo(moment);
  }

  /**
   * 删除生活碎片
   * @param hard true = 物理删除；false = 软删除 status → ARCHIVED
   */
  async remove(id: number, hard: boolean): Promise<void> {
    const existing = await this.prisma.lifeMoment.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new BusinessException(LifeBizError.NOT_FOUND);
    }

    if (hard) {
      await this.prisma.lifeMoment.delete({ where: { id } });
      // 物理删除时清理本地媒体文件
      this.tryDeleteMedia(existing);
    } else {
      await this.prisma.lifeMoment.update({
        where: { id },
        data: { status: PrismaLifeStatus.ARCHIVED },
      });
    }
  }

  /* ==================== 相册 CRUD ==================== */

  /** 查询全部相册（按 sortOrder + id 升序） */
  async queryAlbums(): Promise<LifeAlbumVo[]> {
    const albums = await this.prisma.lifeAlbum.findMany({
      select: LIFE_ALBUM_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return albums.map((a) => this.toAlbumVo(a));
  }

  /** 创建相册 */
  async createAlbum(dto: CreateLifeAlbumDto): Promise<LifeAlbumVo> {
    const album = await this.prisma.lifeAlbum.create({
      data: {
        name: dto.name,
        description: dto.description,
        coverUrl: dto.coverUrl,
        sortOrder: dto.sortOrder,
      },
      select: LIFE_ALBUM_SELECT,
    });
    return this.toAlbumVo(album);
  }

  /** 更新相册 */
  async updateAlbum(
    id: number,
    dto: UpdateLifeAlbumDto,
  ): Promise<LifeAlbumVo> {
    const existing = await this.prisma.lifeAlbum.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new BusinessException(LifeBizError.ALBUM_NOT_FOUND);
    }

    const data: Prisma.LifeAlbumUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.coverUrl !== undefined) data.coverUrl = dto.coverUrl;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    const album = await this.prisma.lifeAlbum.update({
      where: { id },
      data,
      select: LIFE_ALBUM_SELECT,
    });
    return this.toAlbumVo(album);
  }

  /**
   * 删除相册（物理删除）
   * 关联碎片的 albumId 由 Prisma onDelete: SetNull 自动置空
   */
  async removeAlbum(id: number): Promise<void> {
    const existing = await this.prisma.lifeAlbum.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new BusinessException(LifeBizError.ALBUM_NOT_FOUND);
    }
    await this.prisma.lifeAlbum.delete({ where: { id } });
  }

  /* ==================== 私有校验 ==================== */

  /** 校验相册存在，不存在 → throw ALBUM_NOT_FOUND */
  private async validateAlbum(albumId: number): Promise<void> {
    const album = await this.prisma.lifeAlbum.findUnique({
      where: { id: albumId },
      select: { id: true },
    });
    if (!album) {
      throw new BusinessException(LifeBizError.ALBUM_NOT_FOUND);
    }
  }

  /** 物理删除碎片时清理本地媒体文件（mediaUrl / thumbnailUrl） */
  private tryDeleteMedia(moment: {
    mediaUrl: string | null;
    thumbnailUrl: string | null;
  }): void {
    try {
      if (moment.mediaUrl) {
        this.storageService.delete(moment.mediaUrl);
      }
      if (moment.thumbnailUrl && moment.thumbnailUrl !== moment.mediaUrl) {
        this.storageService.delete(moment.thumbnailUrl);
      }
    } catch (e) {
      // 媒体清理失败不阻断删除流程，仅记录日志
      this.logger.warn(`清理碎片媒体文件失败：${(e as Error).message}`);
    }
  }

  /* ==================== VO 转换 ==================== */

  /** Prisma LifeMoment（含 album） → LifeMomentVo */
  private toMomentVo(moment: LifeMomentPayload): LifeMomentVo {
    return {
      id: moment.id,
      type: toDtoType(moment.type),
      status: toDtoStatus(moment.status),
      title: moment.title,
      content: moment.content,
      date: moment.date.toISOString(),
      mood: moment.mood,
      sortOrder: moment.sortOrder,
      featured: moment.featured,
      mediaUrl: moment.mediaUrl,
      mediaType: moment.mediaType,
      thumbnailUrl: moment.thumbnailUrl,
      gradientFrom: moment.gradientFrom,
      gradientTo: moment.gradientTo,
      coverColor: moment.coverColor,
      artist: moment.artist,
      playCount: moment.playCount,
      externalLink: moment.externalLink,
      comment: moment.comment,
      bookAuthor: moment.bookAuthor,
      rating: moment.rating,
      bookType: moment.bookType,
      span: moment.span,
      heightKey: moment.heightKey,
      albumId: moment.albumId,
      album: moment.album
        ? { id: moment.album.id, name: moment.album.name }
        : null,
      geoLat: moment.geoLat,
      geoLng: moment.geoLng,
      locationName: moment.locationName,
      createdAt: moment.createdAt.toISOString(),
      updatedAt: moment.updatedAt.toISOString(),
    };
  }

  /** Prisma LifeAlbum → LifeAlbumVo */
  private toAlbumVo(album: LifeAlbumPayload): LifeAlbumVo {
    return {
      id: album.id,
      name: album.name,
      description: album.description,
      coverUrl: album.coverUrl,
      sortOrder: album.sortOrder,
      createdAt: album.createdAt.toISOString(),
      updatedAt: album.updatedAt.toISOString(),
    };
  }
}
