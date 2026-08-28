import { IsNotEmpty, IsNumber, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 登录请求参数（含验证码）
 */
export class LoginDto {
  @ApiProperty({ description: '用户名', example: 'admin' })
  @IsString({ message: '用户名必须是字符串' })
  @IsNotEmpty({ message: '用户名不能为空' })
  username: string;

  @ApiProperty({ description: '密码', minLength: 6, example: 'admin123' })
  @IsString({ message: '密码必须是字符串' })
  @MinLength(6, { message: '密码至少 6 位' })
  password: string;

  @ApiProperty({ description: '验证码 ID', example: 'a1b2c3d4-...' })
  @IsString({ message: '验证码 ID 必须是字符串' })
  @IsNotEmpty({ message: '验证码 ID 不能为空' })
  captchaId: string;

  @ApiProperty({ description: '滑块拖动 x 坐标', example: 127 })
  @IsNumber({}, { message: '滑块位置必须是数字' })
  slideX: number;
}

/**
 * 修改密码请求参数（需登录）
 */
export class ChangePasswordDto {
  @ApiProperty({ description: '旧密码', example: 'admin123' })
  @IsString({ message: '旧密码必须是字符串' })
  @IsNotEmpty({ message: '旧密码不能为空' })
  oldPassword: string;

  @ApiProperty({ description: '新密码', minLength: 6, example: 'newpass123' })
  @IsString({ message: '新密码必须是字符串' })
  @MinLength(6, { message: '新密码至少 6 位' })
  newPassword: string;
}

/**
 * 登录成功响应
 */
export interface TokenPayload {
  accessToken: string;
  expiresIn: number;   // 秒
  tokenType: string;   // Bearer
}

/**
 * 用户信息（GET /auth/profile 响应）
 * 与前端 authStore 字段完全一致
 */
export interface UserProfile {
  id: number;
  username: string;
  nickname: string;
  email: string | null;
  avatar: string | null;
  role: string;
}
