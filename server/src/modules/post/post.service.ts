import { Injectable } from '@nestjs/common';
import { BusinessException } from '@/common/exception';
import { PostBizError } from './enums/post-biz-error.enum';
import {
  CreatePostDto,
  PostPageVo,
  PostVo,
  QueryPostDto,
  UpdatePostDto,
} from './dto/post.dto';

/**
 * Post Service：文章 CRUD 骨架
 * 后续替换为 Prisma 即可。
 */
@Injectable()
export class PostService {
  private mockPosts: PostVo[] = [];

  async query(dto: QueryPostDto): Promise<PostPageVo> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 10;
    return {
      list: this.mockPosts.slice(
        (page - 1) * pageSize,
        page * pageSize,
      ),
      total: this.mockPosts.length,
      page,
      pageSize,
    };
  }

  async findById(id: number): Promise<PostVo> {
    const post = this.mockPosts.find((p) => p.id === id);
    if (!post) {
      throw new BusinessException(PostBizError.NOT_FOUND);
    }
    return post;
  }

  async findBySlug(slug: string): Promise<PostVo> {
    const post = this.mockPosts.find((p) => p.slug === slug);
    if (!post) {
      throw new BusinessException(PostBizError.NOT_FOUND);
    }
    return post;
  }

  async create(dto: CreatePostDto): Promise<PostVo> {
    const post: PostVo = {
      id: Date.now(),
      slug:
        dto.title
          ?.toLowerCase()
          .replace(/\s+/g, '-')
          .slice(0, 32) + '-' + Math.random().toString(36).slice(2, 6),
      title: dto.title,
      summary: dto.summary,
      content: dto.content,
      category: dto.category,
      tags: dto.tags ?? [],
      status: dto.status ?? 'draft',
      wordCount: dto.content?.length ?? 0,
      readMinutes: Math.max(1, Math.ceil((dto.content?.length ?? 0) / 500)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.mockPosts.unshift(post);
    return post;
  }

  async update(id: number, dto: UpdatePostDto): Promise<PostVo> {
    const post = await this.findById(id);
    Object.assign(post, dto, { updatedAt: new Date().toISOString() });
    return post;
  }

  async remove(id: number): Promise<void> {
    const before = this.mockPosts.length;
    this.mockPosts = this.mockPosts.filter((p) => p.id !== id);
    if (this.mockPosts.length === before) {
      throw new BusinessException(PostBizError.NOT_FOUND);
    }
  }
}
