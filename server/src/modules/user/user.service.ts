import { Injectable } from '@nestjs/common';
import { BusinessException } from '@/common/exception';
import { PrismaService } from '@/common/prisma.service';
import { UpdateProfileDto } from './dto/user.dto';
import { UserBizError } from './enums/user-biz-error.enum';
import type { UserProfile } from '../auth/dto/auth.dto';

/**
 * User Service（个人自我管理 · 真实查数据库）
 *
 * 所有接口都操作当前登录用户的资料，不接受外部用户 ID 作为入参（安全设计）。
 * username / role / status 是账号级字段，不在此模块暴露修改。
 */
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取当前登录用户资料
   * 与 AuthService.profile 保持一致，但放在 User 模块语义更清晰
   */
  async getProfile(userId: number): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        nickname: true,
        email: true,
        avatar: true,
        role: true,
      },
    });

    if (!user) {
      throw new BusinessException(UserBizError.NOT_FOUND);
    }

    // Prisma nickname 可空，兜底为 username，保持对外接口 nickname 必有值
    return {
      ...user,
      nickname: user.nickname ?? user.username,
    };
  }

  /**
   * 更新当前登录用户资料
   * 只更新 DTO 中 **显式传入** 的字段（undefined 不碰）
   * 传空字符串的字段（如 email=""）会被清空（置 null）
   */
  async updateProfile(userId: number, dto: UpdateProfileDto): Promise<UserProfile> {
    // 1. 先确认用户存在
    await this.prisma.user.findUnique({ where: { id: userId } }).then((u) => {
      if (!u) throw new BusinessException(UserBizError.NOT_FOUND);
    });

    // 2. 构建 update data：undefined 跳过，空字符串 → null
    const data: { nickname?: string; email?: string | null; avatar?: string | null } = {};
    if (dto.nickname !== undefined) data.nickname = dto.nickname;
    if (dto.email !== undefined) data.email = dto.email === '' ? null : dto.email;
    if (dto.avatar !== undefined) data.avatar = dto.avatar === '' ? null : dto.avatar;

    // 3. 全空 → 直接返回原资料（避免无意义 UPDATE SQL）
    if (Object.keys(data).length === 0) {
      return this.getProfile(userId);
    }

    // 4. Prisma update
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        username: true,
        nickname: true,
        email: true,
        avatar: true,
        role: true,
      },
    });

    return {
      ...updated,
      nickname: updated.nickname ?? updated.username,
    };
  }
}
