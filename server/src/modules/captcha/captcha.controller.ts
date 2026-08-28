import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CaptchaService } from './captcha.service';
import { CaptchaResponse } from './dto/captcha.dto';
import { Result } from '@/common/result';

/**
 * 验证码 Controller
 * 公开接口，无需登录
 */
@ApiTags('验证码 Captcha')
@Controller('auth')
export class CaptchaController {
  constructor(private readonly captchaService: CaptchaService) {}

  @Get('captcha')
  @ApiOperation({ summary: '获取滑块验证码图片' })
  async getCaptcha(): Promise<Result<CaptchaResponse>> {
    const data = await this.captchaService.generate();
    return Result.ok(data);
  }
}
