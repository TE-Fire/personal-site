import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @MinLength(2)
  username: string;

  @ApiProperty({ example: '123456', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'TE-Fire', required: false })
  @IsString()
  @IsOptional()
  nickname?: string;

  @ApiProperty({ example: 'admin@example.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;
}

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  nickname?: string;

  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  email?: string;
}

/**
 * 用户实体骨架（等 Prisma generate 后替换为 @prisma/client 类型）
 */
export interface UserVo {
  id: number;
  username: string;
  nickname?: string;
  email?: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}
