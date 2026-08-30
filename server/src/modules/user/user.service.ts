import { Injectable } from '@nestjs/common';
import { BusinessException } from '@/common/exception';
import { UserBizError } from './enums/user-biz-error.enum';
import { CreateUserDto, UpdateUserDto, UserVo } from './dto/user.dto';

/**
 * User Service：CRUD 骨架（目前走内存 mock）
 * 后续接入 Prisma 后直接替换为 this.prisma.user.*
 */
@Injectable()
export class UserService {
  private readonly mockUser: UserVo = {
    id: 1,
    username: 'admin',
    nickname: 'TE-Fire',
    email: 'admin@example.com',
    role: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  async findAll(): Promise<UserVo[]> {
    return [this.mockUser];
  }

  async findById(id: number): Promise<UserVo> {
    if (id !== this.mockUser.id) {
      throw new BusinessException(UserBizError.NOT_FOUND);
    }
    return this.mockUser;
  }

  async create(dto: CreateUserDto): Promise<UserVo> {
    dto;
    return this.mockUser;
  }

  async update(id: number, dto: UpdateUserDto): Promise<UserVo> {
    dto;
    return { ...this.mockUser, id };
  }

  async remove(id: number): Promise<void> {
    id;
    // 占位
  }
}
