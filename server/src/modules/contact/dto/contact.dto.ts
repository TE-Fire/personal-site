import { IsString, IsOptional, MaxLength } from 'class-validator';

/**
 * Contact 模块 DTO 集合
 *
 *   · UpdateContactDto —— PUT /api/contact 入参（admin 保存联系方式字段）
 *   · ContactRsp       —— GET /api/contact 返回结构（ContactPage / ProfilePage 共用）
 *
 * 与 About 模块保持一致的 camelCase 风格；联系方式字段无嵌套对象，
 * 全部为标量，故 UpdateContactDto 不需要 @ValidateNested。
 */

/* ============================================================
 *  PUT /api/contact 入参 DTO
 * ============================================================ */

/**
 * PUT /api/contact 入参（管理员保存 Contact 展示字段）
 *
 * 字段对应 Prisma User 表的 contact_* 列；微信二维码可为空（用户未上传时为 null）。
 */
export class UpdateContactDto {
  /* ----------- 邮箱 ----------- */
  @IsString()
  @MaxLength(100)
  contactEmail!: string;

  @IsString()
  @MaxLength(200)
  contactEmailHint!: string;

  /* ----------- GitHub ----------- */
  @IsString()
  @MaxLength(500)
  contactGithubUrl!: string;

  @IsString()
  @MaxLength(100)
  contactGithubLabel!: string;

  @IsString()
  @MaxLength(200)
  contactGithubHint!: string;

  /* ----------- 微信 ----------- */
  @IsString()
  @MaxLength(100)
  contactWechatId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  contactWechatQr!: string | null;

  @IsString()
  @MaxLength(200)
  contactWechatHint!: string;
}

/* ============================================================
 *  GET /api/contact 返回 DTO
 * ============================================================ */

/** 邮箱联系方式条目 */
export interface ContactEmailItem {
  /** 邮箱地址（展示值） */
  value: string;
  /** 邮箱说明（如"工作日 24h 内回复"） */
  hint: string;
  /** 一键复制用值（前端 copy-to-clipboard） */
  copyValue: string;
  /** mailto: 链接 URL */
  linkUrl: string;
  /** 链接展示文字（如"hello@trae.dev"） */
  linkText: string;
  /** 整体描述（兜底用 hint，前端可二选一展示） */
  description: string;
}

/** GitHub 联系方式条目 */
export interface ContactGithubItem {
  /** GitHub 用户名 / label（展示值） */
  value: string;
  /** 说明 */
  hint: string;
  /** GitHub 主页链接 */
  linkUrl: string;
  /** 链接展示文字 */
  linkText: string;
  /** 整体描述 */
  description: string;
}

/** 微信联系方式条目 */
export interface ContactWechatItem {
  /** 微信号（展示值） */
  value: string;
  /** 说明 */
  hint: string;
  /** 一键复制的微信号（与 value 一致，前端 copy 用） */
  copyValue: string;
  /** 微信二维码图片路径（可空，未上传时为 null） */
  qrCode: string | null;
  /** 整体描述 */
  description: string;
}

/** GET /api/contact 返回结构 */
export interface ContactRsp {
  /** 邮箱条目 */
  email: ContactEmailItem;
  /** GitHub 条目 */
  github: ContactGithubItem;
  /** 微信条目 */
  wechat: ContactWechatItem;
}
