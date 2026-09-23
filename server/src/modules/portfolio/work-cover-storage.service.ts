import { Injectable, Logger } from '@nestjs/common';
import { existsSync, unlinkSync } from 'fs';
import { join, normalize, sep } from 'path';
import { BusinessException } from '@/common/exception';
import { PortfolioBizError } from './enums/portfolio-biz-error.enum';

/**
 * WorkCoverStorageService — 作品封面图本地存储服务
 *
 * 与 Life 模块的 LocalStorageService 同构（MIME 白名单 + 体积校验 + 旧文件清理），
 * 但只处理图片（封面不需要音频），目录独立在 public/uploads/works/。
 *
 * 注意：
 *   · 写盘由 Controller 层 FileInterceptor 的 diskStorage 完成，
 *     本服务只做事后校验 / 返回访问 URL / 清理旧文件
 *   · 未来切换 MinIO / OSS 时替换本实现即可（Controller 层无需改动）
 */
@Injectable()
export class WorkCoverStorageService {
  private readonly logger = new Logger(WorkCoverStorageService.name);

  /** 磁盘目录：public/uploads/works/ */
  private readonly uploadDir = join(process.cwd(), 'public', 'uploads', 'works');

  /** 访问 URL 前缀（server/public 已通过 useStaticAssets 以 / 前缀托管） */
  readonly urlPrefix = '/uploads/works/';

  /** 允许的图片 MIME */
  private readonly imageMimes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ]);

  /** 图片大小上限：10MB */
  private readonly imageMaxSize = 10 * 1024 * 1024;

  /**
   * 校验 multer 写盘后的文件，返回可访问 URL。
   * 不合法时先删掉已落盘的脏文件再抛业务异常。
   */
  upload(file: Express.Multer.File): { url: string; mimeType: string } {
    if (!file) {
      throw new BusinessException(PortfolioBizError.NO_FILE, '未收到上传文件');
    }

    const mime = file.mimetype;
    if (!this.imageMimes.has(mime)) {
      this.tryUnlink(join(this.uploadDir, file.filename));
      throw new BusinessException(
        PortfolioBizError.UNSUPPORTED_MEDIA,
        '仅支持 jpg/jpeg/png/webp/gif 图片',
      );
    }

    if (file.size > this.imageMaxSize) {
      this.tryUnlink(join(this.uploadDir, file.filename));
      throw new BusinessException(
        PortfolioBizError.FILE_TOO_LARGE,
        '图片大小不能超过 10MB',
      );
    }

    return { url: `${this.urlPrefix}${file.filename}`, mimeType: mime };
  }

  /**
   * 删除本地封面文件（外链 http(s):// 直接跳过）。
   * 用于：作品删除时清理，或替换封面时清理旧文件。
   */
  delete(filePath: string): void {
    if (!filePath) return;
    if (/^https?:\/\//i.test(filePath)) return; // 外链不处理

    const localPath = this.toLocalPath(filePath);
    if (!localPath) return;
    this.tryUnlink(localPath);
  }

  /** '/uploads/works/xxx.jpg' → 本地绝对路径；非本目录返回 null（防路径穿越） */
  private toLocalPath(url: string): string | null {
    let rel: string | null = null;
    if (url.startsWith(this.urlPrefix)) {
      rel = url.slice(this.urlPrefix.length);
    } else if (url.startsWith('uploads/works/')) {
      rel = url.slice('uploads/works/'.length);
    } else if (url.startsWith('public/uploads/works/')) {
      rel = url.slice('public/uploads/works/'.length);
    }
    if (!rel) return null;

    const full = normalize(join(this.uploadDir, rel));
    if (!full.startsWith(this.uploadDir + sep) && full !== this.uploadDir) {
      this.logger.warn(`拒绝删除 uploadDir 之外的文件：${full}`);
      return null;
    }
    return full;
  }

  /** 安全 unlink：不存在或失败都不抛错 */
  private tryUnlink(absPath: string): void {
    if (!existsSync(absPath)) return;
    try {
      unlinkSync(absPath);
    } catch (e) {
      this.logger.warn(`删除文件失败：${absPath} - ${(e as Error).message}`);
    }
  }
}
