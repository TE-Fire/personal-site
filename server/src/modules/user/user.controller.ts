import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { Result } from '@/common/result';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from './user.service';
import { UpdateProfileDto, AvatarUploadRsp } from './dto/user.dto';
import { BusinessException } from '@/common/exception';
import { UserBizError } from './enums/user-biz-error.enum';
import type { UserProfile } from '../auth/dto/auth.dto';

/* ---------- 头像上传 Multer 配置 ---------- */
const AVATAR_DIR = join(process.cwd(), 'public', 'uploads', 'avatar');
const AVATAR_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const AVATAR_ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const avatarStorage = diskStorage({
  destination: (_req, _file, cb) => {
    // 启动时自动创建目录（如果不存在）
    if (!existsSync(AVATAR_DIR)) {
      mkdirSync(AVATAR_DIR, { recursive: true });
    }
    cb(null, AVATAR_DIR);
  },
  filename: (_req, file, cb) => {
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const ext = extname(file.originalname).toLowerCase() || '.png';
    cb(null, `${stamp}-${rand}${ext}`);
  },
});

/**
 * Multer fileFilter：mimetype 不匹配时直接抛 BusinessException
 * 全局异常过滤器会把它包成统一 { code, message, data } 响应
 */
const avatarFileFilter = (_req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
  if (!AVATAR_ALLOWED_MIMES.has(file.mimetype)) {
    return cb(new BusinessException(UserBizError.AVATAR_UPLOAD_FAILED, '仅支持 JPG / PNG / WEBP / GIF 格式'), false);
  }
  cb(null, true);
};

/**
 * User Controller —— 个人自我管理
 *
 * 所有接口都需 JWT 登录，操作对象固定是当前登录用户（userId 从 req.user 取）。
 * 不暴露任何按用户 ID 查询的路由（避免越权读取别人资料）。
 */
@ApiTags('用户 User')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /* ---------- GET /users/me ---------- */
  @Get('me')
  @ApiOperation({ summary: '获取当前登录用户资料' })
  async me(@Req() req: Request): Promise<Result<UserProfile>> {
    const userId = (req.user as { id: number }).id;
    return Result.ok(await this.userService.getProfile(userId));
  }

  /* ---------- POST /users/me ---------- */
  @Post('me')
  @ApiOperation({ summary: '更新当前登录用户资料（nickname/email/avatar）' })
  async updateMe(
    @Req() req: Request,
    @Body() dto: UpdateProfileDto,
  ): Promise<Result<UserProfile>> {
    const userId = (req.user as { id: number }).id;
    return Result.ok(await this.userService.updateProfile(userId, dto), '更新成功');
  }

  /* ---------- POST /users/avatar  头像上传 ---------- */
  @Post('avatar')
  @ApiOperation({ summary: '上传头像（返回可直接访问的 URL，自动绑定到当前账号）' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: avatarStorage,
      limits: { fileSize: AVATAR_MAX_SIZE },
      fileFilter: avatarFileFilter,
    }),
  )
  async uploadAvatar(@Req() req: Request): Promise<Result<AvatarUploadRsp>> {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      throw new BusinessException(UserBizError.AVATAR_UPLOAD_FAILED, '未收到上传文件');
    }

    const userId = (req.user as { id: number }).id;
    const url = `/uploads/avatar/${file.filename}`;

    try {
      // 1. 拿到当前头像 URL（如果有旧的本地头像，上传新的成功后删掉）
      const current = await this.userService.getProfile(userId);
      const oldAvatar = current.avatar;

      // 2. 清理旧头像（跳过空值和外链头像 —— http 开头的是 CDN / 图床，不要碰）
      if (oldAvatar && !oldAvatar.startsWith('http')) {
        const oldPath = this.toLocalPath(oldAvatar);
        if (oldPath && existsSync(oldPath)) {
          try { unlinkSync(oldPath); } catch { /* ignore */ }
        }
      }

      // 3. 自动把新头像绑到用户资料（省掉前端再调一次 POST /users/me）
      await this.userService.updateProfile(userId, { avatar: url });

      return Result.ok(
        {
          url,
          size: file.size,
          mimeType: file.mimetype,
          originalName: file.originalname,
        },
        '头像上传成功',
      );
    } catch (err) {
      // 回滚：删掉刚写入磁盘但没成功绑到资料上的文件
      const cleanupPath = join(AVATAR_DIR, file.filename);
      if (existsSync(cleanupPath)) {
        try { unlinkSync(cleanupPath); } catch { /* ignore */ }
      }
      throw err;
    }
  }

  /* ---------- DELETE /users/avatar  清除头像 ---------- */
  @Delete('avatar')
  @ApiOperation({ summary: '清除当前登录用户头像（置空并删除磁盘文件）' })
  async removeAvatar(@Req() req: Request): Promise<Result<null>> {
    const userId = (req.user as { id: number }).id;
    const current = await this.userService.getProfile(userId);

    if (current.avatar && !current.avatar.startsWith('http')) {
      const filePath = this.toLocalPath(current.avatar);
      if (filePath && existsSync(filePath)) {
        try { unlinkSync(filePath); } catch { /* ignore */ }
      }
    }

    await this.userService.updateProfile(userId, { avatar: '' });
    return Result.ok(null, '头像已清除');
  }

  /** URL → 本地磁盘路径。传入形如 "/uploads/avatar/xxx.jpg" 或 "uploads/avatar/xxx.jpg" */
  private toLocalPath(url: string): string | null {
    const prefix = '/uploads/';
    const rel = url.startsWith(prefix) ? url.slice(1) : url;
    if (!rel.startsWith('uploads/')) return null;
    return join(process.cwd(), 'public', rel);
  }
}
