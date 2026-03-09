import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { ListNewsDto } from './dto/list-news.dto';

@Injectable()
export class NewsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly defaultInclude = {
    author: {
      select: {
        id: true,
        nameEN: true,
        profilePhotoId: true,
      },
    },
    community: {
      select: {
        id: true,
        name: true,
      },
    },
  } as const;

  private mapRow(row: any) {
    return {
      ...row,
      authorName: row.authorName || row.author?.nameEN || null,
      authorPhotoUrl: row.authorPhotoUrl || (row.author?.profilePhotoId
        ? `/files/${row.author.profilePhotoId}/stream`
        : null),
      imageUrl: row.imageFileId ? `/files/${row.imageFileId}/stream` : null,
      communityName: row.community?.name || null,
    };
  }

  async create(dto: CreateNewsDto, actorUserId: string) {
    const author = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { nameEN: true, profilePhotoId: true },
    });

    const row = await this.prisma.communityUpdate.create({
      data: {
        caption: dto.caption.trim(),
        imageFileId: dto.imageFileId || null,
        authorId: actorUserId,
        authorName: author?.nameEN || null,
        authorPhotoUrl: author?.profilePhotoId
          ? `/files/${author.profilePhotoId}/stream`
          : null,
        communityId: dto.communityId || null,
      },
      include: this.defaultInclude,
    });

    return this.mapRow(row);
  }

  async findAll(query: ListNewsDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;

    const where: Prisma.CommunityUpdateWhereInput = {};

    if (query.communityId) {
      where.communityId = query.communityId;
    }
    if (query.search) {
      const q = query.search.trim();
      where.caption = { contains: q, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.communityUpdate.findMany({
        where,
        include: this.defaultInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.communityUpdate.count({ where }),
    ]);

    return {
      data: data.map((row) => this.mapRow(row)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const row = await this.prisma.communityUpdate.findUnique({
      where: { id },
      include: this.defaultInclude,
    });
    if (!row) throw new NotFoundException('News item not found');
    return this.mapRow(row);
  }

  async update(id: string, dto: UpdateNewsDto) {
    await this.findOne(id);

    const data: Prisma.CommunityUpdateUpdateInput = {};
    if (dto.caption !== undefined) data.caption = dto.caption.trim();
    if (dto.imageFileId !== undefined) data.imageFileId = dto.imageFileId || null;
    if (dto.communityId !== undefined) {
      data.community = dto.communityId
        ? { connect: { id: dto.communityId } }
        : { disconnect: true };
    }

    const row = await this.prisma.communityUpdate.update({
      where: { id },
      data,
      include: this.defaultInclude,
    });

    return this.mapRow(row);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.communityUpdate.delete({ where: { id } });
    return { success: true };
  }
}
