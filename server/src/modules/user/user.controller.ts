import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, UserVo } from './dto/user.dto';
import { Result } from '@/common/result';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * User Controller：用户资源 CRUD
 * 标记 @UseGuards(JwtAuthGuard) 之后所有接口都需要登录
 */
@ApiTags('用户 User')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: '查询用户列表' })
  async findAll(): Promise<Result<UserVo[]>> {
    return Result.ok(await this.userService.findAll());
  }

  @Get(':id')
  @ApiOperation({ summary: '查询单个用户' })
  async findById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Result<UserVo>> {
    return Result.ok(await this.userService.findById(id));
  }

  @Post()
  @ApiOperation({ summary: '创建用户' })
  async create(@Body() dto: CreateUserDto): Promise<Result<UserVo>> {
    return Result.ok(await this.userService.create(dto), '创建成功');
  }

  @Put(':id')
  @ApiOperation({ summary: '更新用户' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ): Promise<Result<UserVo>> {
    return Result.ok(await this.userService.update(id, dto), '更新成功');
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除用户' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Result<null>> {
    await this.userService.remove(id);
    return Result.ok(null, '删除成功');
  }
}
