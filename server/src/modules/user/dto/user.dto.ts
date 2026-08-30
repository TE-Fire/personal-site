import { IsEmail, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * PUT/POST /users/me 请求体
 * 允许修改：nickname / email / avatar
 * 不允许修改：username / role / status（账号级字段写死在注册/初始化时）
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ description: '昵称', example: 'TE-Fire', maxLength: 50 })
  @ValidateIf((o) => o.nickname !== undefined && o.nickname !== null)
  @IsString({ message: '昵称必须是字符串' })
  @MaxLength(50, { message: '昵称最多 50 字符' })
  nickname?: string;

  @ApiPropertyOptional({ description: '邮箱', example: 'admin@example.com' })
  @ValidateIf((o) => o.email !== undefined && o.email !== null && o.email !== '')
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(100, { message: '邮箱最多 100 字符' })
  email?: string;

  @ApiPropertyOptional({ description: '头像 URL（也可通过 POST /users/avatar 上传获取）', example: 'https://.../avatar.jpg' })
  @ValidateIf((o) => o.avatar !== undefined && o.avatar !== null && o.avatar !== '')
  @IsString({ message: '头像 URL 必须是字符串' })
  @MaxLength(500, { message: '头像 URL 最多 500 字符' })
  avatar?: string;
}

/**
 * POST /users/avatar 上传成功响应
 */
export interface AvatarUploadRsp {
  /** 可直接访问的头像 URL（前端可立即用作 <img src>） */
  url: string;
  /** 文件大小（字节） */
  size: number;
  /** 文件 MIME 类型 */
  mimeType: string;
  /** 原始文件名 */
  originalName: string;
}
