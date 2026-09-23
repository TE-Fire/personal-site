import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BusinessException } from '@/common/exception';
import { Result } from '@/common/result';
import {
  CONTACT_PUBLIC_KEY,
  REDIS_TTL,
} from '@/common/constants/redis-keys';
import { UpdateContactDto } from './dto/contact.dto';
import type { ContactRsp } from './dto/contact.dto';
import { ContactBizError, getContactErrorInfo } from './enums/contact-biz-error.enum';

/**
 * Contact 公开资料字段类型（直接映射 Prisma 返回的行对象结构，用于 TS 类型收窄）
 */
interface ContactUserRow {
  id: number;
  contactEmail: string;
  contactEmailHint: string;
  contactGithubUrl: string;
  contactGithubLabel: string;
  contactGithubHint: string;
  contactWechatId: string;
  contactWechatQr: string | null;
  contactWechatHint: string;
}

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /* ============================== 公开读：GET /api/contact ============================== */

  /**
   * 获取 Contact 公开展示数据
   * 流程：Redis 命中 → 返回；否则查 DB → 写 Redis（60s）→ 返回
   * Redis 任何异常（挂/未启动/超时）→ 降级直连 DB，不影响业务。
   */
  async getPublicContact(): Promise<ContactRsp> {
    // 1. 先读 Redis
    try {
      const cached = await this.redis.get(CONTACT_PUBLIC_KEY);
      if (cached) {
        return JSON.parse(cached) as ContactRsp;
      }
    } catch (err) {
      this.logger.warn(`Redis 读 Contact 缓存失败，降级查 DB：${(err as Error).message}`);
    }

    // 2. 查 DB：取第一行 user（个人博客只有一个博主）
    const row = (await this.prisma.user.findFirst({
      select: {
        id: true,
        contactEmail: true,
        contactEmailHint: true,
        contactGithubUrl: true,
        contactGithubLabel: true,
        contactGithubHint: true,
        contactWechatId: true,
        contactWechatQr: true,
        contactWechatHint: true,
      },
    })) as ContactUserRow | null;

    if (!row) {
      throw new BusinessException(
        getContactErrorInfo(ContactBizError.DATA_MISSING),
      );
    }

    const rsp = this.mapRowToRsp(row);

    // 3. 写 Redis（1 分钟）
    try {
      await this.redis.set(
        CONTACT_PUBLIC_KEY,
        JSON.stringify(rsp),
        REDIS_TTL.CONTACT_PUBLIC,
      );
    } catch (err) {
      this.logger.warn(`Redis 写 Contact 缓存失败（不影响返回）：${(err as Error).message}`);
    }

    return rsp;
  }

  /* ============================== 管理员改：PUT /api/contact ============================== */

  /**
   * 当前登录 admin 保存 Contact 展示字段
   * 1. Prisma update 当前行 id
   * 2. 删除 Redis 缓存（让下次 GET 重建）
   * 3. 返回完整 ContactRsp（前端立即 setState，不用再 GET）
   */
  async saveContact(userId: number, dto: UpdateContactDto): Promise<ContactRsp> {
    // ① 写入 DB
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          contactEmail: dto.contactEmail,
          contactEmailHint: dto.contactEmailHint,
          contactGithubUrl: dto.contactGithubUrl,
          contactGithubLabel: dto.contactGithubLabel,
          contactGithubHint: dto.contactGithubHint,
          contactWechatId: dto.contactWechatId,
          // 微信二维码可为空（用户清空时存 null）
          contactWechatQr: dto.contactWechatQr ?? null,
          contactWechatHint: dto.contactWechatHint,
        },
      });
    } catch (err) {
      this.logger.error(`saveContact Prisma failed: ${(err as Error).message}`);
      throw new BusinessException(getContactErrorInfo(ContactBizError.SAVE_FAILED));
    }

    // ② 删 Contact 公开缓存（失败忽略，最多 1 分钟自然过期）
    try {
      await this.redis.del(CONTACT_PUBLIC_KEY);
    } catch (e) {
      this.logger.warn(`Redis 删 Contact 缓存失败：${(e as Error).message}`);
    }

    // ③ 直接再读一次 DB（重建链路，保证返回最新值）
    return this.getPublicContact();
  }

  /* ============================== 管理员上传：POST /api/contact/upload-qr ============================== */

  /**
   * 保存微信二维码图片路径
   * 1. Prisma update User.contactWechatQr = url
   * 2. 删除 Redis 缓存（让下次 GET 重建）
   * 3. 返回图片访问 URL
   */
  async saveWechatQr(userId: number, url: string): Promise<{ url: string }> {
    // ① 写入 DB
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { contactWechatQr: url },
      });
    } catch (err) {
      this.logger.error(`saveWechatQr Prisma failed: ${(err as Error).message}`);
      throw new BusinessException(getContactErrorInfo(ContactBizError.SAVE_FAILED));
    }

    // ② 删 Contact 公开缓存（失败忽略，最多 1 分钟自然过期）
    try {
      await this.redis.del(CONTACT_PUBLIC_KEY);
    } catch (e) {
      this.logger.warn(`Redis 删 Contact 缓存失败：${(e as Error).message}`);
    }

    return { url };
  }

  /* ============================== 内部：映射 ============================== */

  private mapRowToRsp(row: ContactUserRow): ContactRsp {
    const emailValue = row.contactEmail ?? '';
    const emailHint = row.contactEmailHint ?? '';
    const githubValue = row.contactGithubLabel ?? '';
    const githubHint = row.contactGithubHint ?? '';
    const githubUrl = row.contactGithubUrl ?? '';
    const wechatId = row.contactWechatId ?? '';
    const wechatHint = row.contactWechatHint ?? '';
    const wechatQr = row.contactWechatQr ?? null;

    return {
      email: {
        value: emailValue,
        hint: emailHint,
        copyValue: emailValue,
        linkUrl: `mailto:${emailValue}`,
        linkText: '发送邮件',
        description: emailHint,
      },
      github: {
        value: githubValue,
        hint: githubHint,
        linkUrl: githubUrl,
        linkText: '访问主页',
        description: githubHint,
      },
      wechat: {
        value: wechatId,
        hint: wechatHint,
        copyValue: wechatId,
        qrCode: wechatQr,
        description: wechatHint,
      },
    };
  }
}

/* ============================================================
 *  Export Result.ok 辅助（Controller 直接返回）
 * ============================================================ */
export function contactResult<T>(data: T, msg?: string) {
  return Result.ok(data, msg);
}
