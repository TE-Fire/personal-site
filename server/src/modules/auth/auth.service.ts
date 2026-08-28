import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { BizCode, BusinessException } from '@/common/exception';
import { PrismaService } from '@/common/prisma.service';
import { CaptchaService } from '../captcha/captcha.service';
import { ChangePasswordDto, LoginDto, TokenPayload, UserProfile } from './dto/auth.dto';

/**
 * 认证 Service（阶段二：真实查数据库 + bcrypt 校验）
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly captchaService: CaptchaService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 登录：先校验验证码，再查 user 表 + bcrypt.compare，最后签发 JWT
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

    // 2. 查 user 表
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (!user || user.status !== 1) {
      throw new BusinessException(
        '用户名或密码错误',
        BizCode.PASSWORD_INVALID,
      );
    }

    // 3. bcrypt 校验密码
    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) {
      throw new BusinessException(
        '用户名或密码错误',
        BizCode.PASSWORD_INVALID,
      );
    }

    // 4. 签发 JWT
    const expiresIn = 7 * 24 * 60 * 60; // 7 天（秒）
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
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
   * 获取当前登录用户信息（GET /auth/profile）
   * 与前端 authStore.user 字段完全一致
   */
  async profile(userId: number): Promise<UserProfile> {
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
      throw new BusinessException('用户不存在', BizCode.USER_NOT_FOUND);
    }

    return user;
  }

  /**
   * 修改密码（需登录）
   * 流程：查 user → bcrypt.compare 校验旧密码 → bcrypt.hash 新密码 → prisma.update
   */
  async changePassword(userId: number, dto: ChangePasswordDto): Promise<void> {
    // 1. 查用户（取 password 用于比对）
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, status: true },
    });
    if (!user || user.status !== 1) {
      throw new BusinessException('用户不存在或已禁用', BizCode.USER_NOT_FOUND);
    }

    // 2. 校验旧密码
    const ok = await bcrypt.compare(dto.oldPassword, user.password);
    if (!ok) {
      throw new BusinessException('旧密码错误', BizCode.PASSWORD_INVALID);
    }

    // 3. 新旧不能相同
    if (dto.oldPassword === dto.newPassword) {
      throw new BusinessException('新密码不能与旧密码相同', BizCode.BAD_REQUEST);
    }

    // 4. 加密 + 更新
    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });
  }

  /**
   * JWT Strategy 回调：校验 Token 中的用户
   */
  async validateUser(userId: number): Promise<{ id: number; role: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });

    if (!user || user.status !== 1) {
      return { id: 0, role: 'guest' };
    }
    return { id: user.id, role: user.role };
  }
}
