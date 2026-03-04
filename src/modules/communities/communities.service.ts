import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';

@Injectable()
export class CommunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.community.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateCommunityDto) {
    const name = dto.name.trim();
    const code = dto.code?.trim() || null;

    try {
      return await this.prisma.community.create({
        data: {
          name,
          code,
          displayOrder: dto.displayOrder ?? 0,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Community name/code already exists');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateCommunityDto) {
    const current = await this.prisma.community.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Community not found');

    const nextName = dto.name?.trim();
    const nextCode = dto.code === undefined ? undefined : dto.code.trim() || null;

    const updated = await this.prisma.community.update({
      where: { id },
      data: {
        ...(nextName !== undefined ? { name: nextName } : {}),
        ...(nextCode !== undefined ? { code: nextCode } : {}),
        ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    if (nextName && nextName !== current.name) {
      await this.prisma.unit.updateMany({
        where: { communityId: id },
        data: { projectName: nextName },
      });
    }

    return updated;
  }

  async remove(id: string) {
    const current = await this.prisma.community.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Community not found');

    const linkedUnits = await this.prisma.unit.count({ where: { communityId: id } });
    if (linkedUnits > 0) {
      throw new BadRequestException(
        'Cannot delete community while units are linked. Reassign units first.',
      );
    }

    await this.prisma.community.delete({ where: { id } });
    return { success: true };
  }
}
