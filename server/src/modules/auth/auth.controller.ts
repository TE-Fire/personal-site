import { Body, Controller, Get, Post, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, TokenPayload } from './dto/auth.dto';
import { Result } from '@/common/result';

/**
 * Auth Controller：公开接口，无需登录即可访问
 */
@ApiTags('认证 Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: '账号密码登录' })
  async login(@Body() dto: LoginDto): Promise<Result<TokenPayload>> {
    const data = await this.authService.login(dto);
    return Result.ok(data, '登录成功');
  }

  @Post('register')
  @ApiOperation({ summary: '注册（暂未开放）' })
  async register(@Body() dto: RegisterDto): Promise<Result<null>> {
    await this.authService.register(dto);
    return Result.ok(null, '注册成功');
  }
}
