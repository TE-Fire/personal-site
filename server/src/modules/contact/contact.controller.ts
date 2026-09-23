import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Request, Response } from 'express';
import { Result } from '@/common/result';
import { BusinessException } from '@/common/exception';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { REDIS_TTL } from '@/common/constants/redis-keys';
import { ContactService } from './contact.service';
import { UpdateContactDto } from './dto/contact.dto';
import type { ContactRsp } from './dto/contact.dto';

/* ---------- Contact 微信二维码上传 Multer 配置 ---------- */
const CONTACT_UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'contact');
const CONTACT_UPLOAD_MAX_SIZE = 10 * 1024 * 1024; // 10MB（二维码图片上限）

const contactStorage = diskStorage({
  destination: (_req, _file, cb) => {
    // 启动时自动创建目录（如果不存在）
    if (!existsSync(CONTACT_UPLOAD_DIR)) {
      mkdirSync(CONTACT_UPLOAD_DIR, { recursive: true });
    }
    cb(null, CONTACT_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const ext = extname(file.originalname).toLowerCase() || '.bin';
    cb(null, `${stamp}-${rand}${ext}`);
  },
});

/** 上传二维码响应体 */
interface ContactUploadQrRsp {
  url: string;
}

/**
 * Contact 模块 Controller
 *   · GET  /contact            公开（游客 / admin 都可看），加 Cache-Control 1 min
 *   · PUT  /contact            需 admin 登录（JWT），管理保存
 *   · POST /contact/upload-qr 需 admin 登录（JWT），上传微信二维码图片
 *   · GET  /contact 的缓存由 Service 内部 Redis 再控制一层（双重缓存）
 */
@ApiTags('联系方式 Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  /* ========== GET /api/contact —— 公开 ========== */

  @Get()
  @ApiOperation({
    summary: '获取公开的「联系方式」展示数据（游客可看，1 分钟 HTTP 缓存 + Redis 缓存）',
  })
  async getContact(@Res({ passthrough: true }) res: Response): Promise<Result<ContactRsp>> {
    // 浏览器/CDN 级 HTTP 缓存：60s（公开 + 最大 60s）。
    // 实际一致性由 Service 层 Redis 保证（admin 改完会主动删 Redis key）。
    res.setHeader(
      'Cache-Control',
      `public, max-age=${REDIS_TTL.CONTACT_PUBLIC}`,
    );
    res.setHeader('Vary', 'Accept');
    const data = await this.contactService.getPublicContact();
    return Result.ok(data);
  }

  /* ========== PUT /api/contact —— 管理员改 ========== */

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put()
  @ApiOperation({
    summary: '保存「联系方式」展示字段（admin 登录后通过 /profile Tab 编辑器调用）',
  })
  async updateContact(
    @Req() req: Request,
    @Body() dto: UpdateContactDto,
  ): Promise<Result<ContactRsp>> {
    const userId = (req.user as { id: number }).id;
    const data = await this.contactService.saveContact(userId, dto);
    return Result.ok(data, '保存成功');
  }

  /* ========== POST /api/contact/upload-qr —— 管理员上传微信二维码 ========== */

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('upload-qr')
  @ApiOperation({ summary: '上传微信二维码图片（admin 登录，字段名 file）' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: contactStorage,
      limits: { fileSize: CONTACT_UPLOAD_MAX_SIZE },
    }),
  )
  async uploadQr(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<Result<ContactUploadQrRsp>> {
    // 未收到文件 → 拒绝
    if (!file) {
      throw new BusinessException(6003, '未收到上传文件');
    }
    const url = `/uploads/contact/${file.filename}`;
    const result = await this.contactService.saveWechatQr(
      (req.user as { id: number }).id,
      url,
    );
    return Result.ok(result, '上传成功');
  }
}
