import { Injectable, Logger } from '@nestjs/common';
import { existsSync, unlinkSync } from 'fs';
import { join, normalize, sep } from 'path';
import { BusinessException } from '@/common/exception';
import { LifeBizError } from './enums/life-biz-error.enum';

/**
 * LocalStorageService — Life 模块本地文件存储服务
 *
 * 职责：
 *   · 对上传的文件做 MIME / size 校验（图片 ≤ 10MB，音频 ≤ 30MB）
 *   · 提供 delete(filePath) 删除本地文件，用于清理无用旧文件
 *
 * 注意：
 *   · multer 的 diskStorage 配置在 Controller 里用 FileInterceptor 完成
 *     （destination / filename 在 Controller 层定义，本服务只做事后校验和清理）
 *   · 本服务**不**写入磁盘，磁盘写入由 multer 中间件完成；本服务只
 *     根据 Express.Multer.File 的 mimetype + size 做校验，返回访问 URL
 */
@Injectable()
export class LocalStorageService {
  private readonly logger = new Logger(LocalStorageService.name);

  /** 上传目录相对项目根的路径：public/uploads/life/ */
  private readonly uploadDir = join(process.cwd(), 'public', 'uploads', 'life');

  /** URL 前缀（前端访问路径） */
  private readonly urlPrefix = '/uploads/life/';

  /** 允许的图片 MIME */
  private readonly imageMimes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ]);

  /** 允许的音频 MIME */
  private readonly audioMimes = new Set([
    'audio/mpeg', // mp3
    'audio/mp3',
    'audio/aac',
    'audio/flac',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
  ]);

  /** 图片大小上限：10MB */
  private readonly imageMaxSize = 10 * 1024 * 1024;
  /** 音频大小上限：30MB */
  private readonly audioMaxSize = 30 * 1024 * 1024;

  /**
   * 校验并返回可访问的 URL。
   * 在 Controller 的 @UploadedFile 拿到 multer 写盘后的 file 对象后调用。
   *
   * 校验规则：
   *   · 图片：jpg/jpeg/png/webp/gif，最大 10MB
   *   · 音频：mp3/aac/flac/wav，最大 30MB
   *   · 其他类型 → UNSUPPORTED_MEDIA
   *   · 超出大小 → FILE_TOO_LARGE
   *
   * @param file multer 写盘后的 file 对象
   * @returns { url, mimeType } 返回访问 URL 和 MIME 类型
   */
  upload(file: Express.Multer.File): { url: string; mimeType: string } {
    if (!file) {
      throw new BusinessException(LifeBizError.UNSUPPORTED_MEDIA, '未收到上传文件');
    }

    const mime = file.mimetype;
    const isImage = this.imageMimes.has(mime);
    const isAudio = this.audioMimes.has(mime);

    if (!isImage && !isAudio) {
      // 不支持的格式：先尝试删掉已写入磁盘的脏文件
      this.tryUnlink(join(this.uploadDir, file.filename));
      throw new BusinessException(
        LifeBizError.UNSUPPORTED_MEDIA,
        '仅支持 jpg/jpeg/png/webp/gif 图片，或 mp3/aac/flac/wav 音频',
      );
    }

    const sizeLimit = isImage ? this.imageMaxSize : this.audioMaxSize;
    if (file.size > sizeLimit) {
      // 超出大小：删掉脏文件
      this.tryUnlink(join(this.uploadDir, file.filename));
      const limitMb = Math.floor(sizeLimit / 1024 / 1024);
      throw new BusinessException(
        LifeBizError.FILE_TOO_LARGE,
        `${isImage ? '图片' : '音频'}大小不能超过 ${limitMb}MB`,
      );
    }

    return {
      url: `${this.urlPrefix}${file.filename}`,
      mimeType: mime,
    };
  }

  /**
   * 删除本地文件。
   * @param filePath 形如 '/uploads/life/xxx.jpg' 的 URL 路径，或绝对磁盘路径
   *                  （只识别 /uploads/life/ 前缀的相对路径，外链 http://... 会被跳过）
   */
  delete(filePath: string): void {
    if (!filePath) return;
    // 外链（http(s)://）不处理
    if (/^https?:\/\//i.test(filePath)) return;

    const localPath = this.toLocalPath(filePath);
    if (!localPath) return;
    this.tryUnlink(localPath);
  }

  /**
   * 把 '/uploads/life/xxx.jpg' 这种 URL 路径映射成本地磁盘绝对路径。
   * 安全：normalize 后必须仍在 uploadDir 之下，防止路径穿越。
   */
  private toLocalPath(url: string): string | null {
    const prefix = this.urlPrefix; // '/uploads/life/'
    let rel: string;
    if (url.startsWith(prefix)) {
      rel = url.slice(prefix.length);
    } else if (url.startsWith('uploads/life/')) {
      rel = url.slice('uploads/life/'.length);
    } else if (url.startsWith('public/uploads/life/')) {
      rel = url.slice('public/uploads/life/'.length);
    } else {
      // 不是 life 目录下的文件，忽略
      return null;
    }

    if (!rel) return null;
    const full = normalize(join(this.uploadDir, rel));
    // 防 ../ 穿越到 uploadDir 之外
    if (!full.startsWith(this.uploadDir + sep) && full !== this.uploadDir) {
      this.logger.warn(`拒绝删除 uploadDir 之外的文件：${full}`);
      return null;
    }
    return full;
  }

  /** 安全 unlink：文件不存在或删除失败都不抛错 */
  private tryUnlink(absPath: string): void {
    if (!existsSync(absPath)) return;
    try {
      unlinkSync(absPath);
    } catch (e) {
      this.logger.warn(`删除文件失败：${absPath} - ${(e as Error).message}`);
    }
  }
}
