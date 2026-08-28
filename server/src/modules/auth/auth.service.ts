import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BizCode, BusinessException } from '@/common/exception';
import { CaptchaService } from '../captcha/captcha.service';
import { LoginDto, TokenPayload, UserProfile } from './dto/auth.dto';

/**
 * 认证 Service
 *
 * 阶段一（当前）：admin 凭据从 .env 读取，不依赖数据库
 * 阶段二（接入 MySQL 后）：替换为 Prisma user.findUnique + bcrypt.compare
 */
@Injectable()
export class AuthService {
  /** 从环境变量读取的博主凭据 */
  private readonly adminUsername: string;
  private readonly adminPassword: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly captchaService: CaptchaService,
  ) {
    this.adminUsername = this.config.get('ADMIN_USERNAME') || 'admin';
    this.adminPassword = this.config.get('ADMIN_PASSWORD') || 'admin123';
  }

  /**
   * 登录：先校验验证码，再校验凭据，最后签发 JWT
   */
  async login(dto: LoginDto): Promise<TokenPayload> {
    // 1. 校验滑块验证码
    const captchaOk = await this.captchaService.verify(
      dto.captchaId,
      dto.slideX,
    );
    if (!captchaOk) {
      throw new BusinessException(
        '验证码校验失败，请重试',
        BizCode.CAPTCHA_INVALID,
      );
    }

    // 2. 校验用户名密码（阶段一：直接比对 .env）
    if (
      dto.username !== this.adminUsername ||
      dto.password !== this.adminPassword
    ) {
      throw new BusinessException(
        '用户名或密码错误',
        BizCode.PASSWORD_INVALID,
      );
    }

    // 3. 签发 JWT
    const expiresIn = 7 * 24 * 60 * 60; // 7 天
    const payload = {
      sub: 1, // userId（后续替换为 Prisma user.id）
      username: this.adminUsername,
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
   * 获取当前登录用户信息
   * 与前端 authStore.user 字段完全一致
   */
  async profile(userId: number): Promise<UserProfile> {
    // 阶段一：返回 .env 配置的博主信息
    if (userId !== 1) {
      throw new BusinessException('用户不存在', BizCode.USER_NOT_FOUND);
    }

    return {
      id: 1,
      username: this.adminUsername,
      nickname: this.config.get('ADMIN_NICKNAME') || 'TE-Fire',
      email: this.config.get('ADMIN_EMAIL') || null,
      avatar: this.config.get('ADMIN_AVATAR') || null,
      role: 'admin',
    };
  }

  /**
   * JWT Strategy 回调：校验 Token 中的用户
   */
  async validateUser(userId: number): Promise<{ id: number; role: string }> {
    if (userId !== 1) {
      return { id: 0, role: 'guest' };
    }
    return { id: userId, role: 'admin' };
  }
}
