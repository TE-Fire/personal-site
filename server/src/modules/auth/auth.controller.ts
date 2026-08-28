import { Body, Controller, Get, Post, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, TokenPayload, UserProfile } from './dto/auth.dto';
import { Result } from '@/common/result';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * Auth Controller
 */
@ApiTags('认证 Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: '账号密码 + 滑块验证码登录' })
  async login(@Body() dto: LoginDto): Promise<Result<TokenPayload>> {
    const data = await this.authService.login(dto);
    return Result.ok(data, '登录成功');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiOperation({ summary: '获取当前登录用户信息' })
  async profile(@Req() req: Request): Promise<Result<UserProfile>> {
    const user = req.user as { id: number };
    const data = await this.authService.profile(user.id);
    return Result.ok(data);
  }
}
