import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/common/prisma.service';
import { BizCode, BusinessException } from '@/common/exception';
import { LoginDto, RegisterDto, TokenPayload } from './dto/auth.dto';
import { ConfigService } from '@nestjs/config';

/**
 * 认证 Service：
 *   · 登录：校验账号密码 → 颁发 JWT
 *   · 注册：暂不开放对外注册，由 admin 手动添加（此处保留方法）
 *
 * 注意：bcrypt + prisma 在依赖装完、数据库建好后才会正常工作，
 *       当前骨架仅保证代码结构正确、类型正确。
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 登录：当前用 mock 校验（用户名=密码，admin/admin）
   * 待数据库接入后替换为真实查询。
   */
  async login(dto: LoginDto): Promise<TokenPayload> {
    // mock 逻辑：admin / admin
    if (dto.username !== 'admin' || dto.password !== 'admin') {
      throw new BusinessException('用户名或密码错误', BizCode.PASSWORD_INVALID);
    }

    const expiresIn = 7 * 24 * 60 * 60; // 7 天，和 .env 保持一致
    const payload = {
      sub: 1,              // userId
      username: dto.username,
      role: 'admin',
    };
    const accessToken = this.jwt.sign(payload, {
      expiresIn,
      secret: this.config.get('JWT_SECRET'),
    });

    return {
      accessToken,
      expiresIn,
      tokenType: 'Bearer',
    };
  }

  /**
   * 注册（占位）
   */
  async register(dto: RegisterDto): Promise<void> {
    dto; // 占位，后续接入 prisma.user.create()
    throw new BusinessException('暂不开放注册', BizCode.BAD_REQUEST);
  }

  /**
   * 校验 Token 中的用户信息
   */
  async validateUser(userId: number): Promise<unknown> {
    return { id: userId, role: 'admin' };
  }
}
