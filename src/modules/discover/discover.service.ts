import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpsertDiscoverPlaceDto } from './dto/discover.dto';

@Injectable()
export class DiscoverService {
  constructor(private readonly prisma: PrismaService) {}

  listPublic() {
    return this.prisma.discoverPlace.findMany({
      where: { isActive: true },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  listAdmin() {
    return this.prisma.discoverPlace.findMany({
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  create(dto: UpsertDiscoverPlaceDto) {
    return this.prisma.discoverPlace.create({
      data: {
        name: dto.name.trim(),
        category: dto.category?.trim() || null,
        address: dto.address?.trim() || null,
        mapLink: dto.mapLink?.trim() || null,
        phone: dto.phone?.trim() || null,
        workingHours: dto.workingHours?.trim() || null,
        imageFileId: dto.imageFileId ?? null,
        distanceHint: dto.distanceHint?.trim() || null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpsertDiscoverPlaceDto) {
    const exists = await this.prisma.discoverPlace.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Discover place not found');

    return this.prisma.discoverPlace.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        category: dto.category?.trim() || null,
        address: dto.address?.trim() || null,
        mapLink: dto.mapLink?.trim() || null,
        phone: dto.phone?.trim() || null,
        workingHours: dto.workingHours?.trim() || null,
        imageFileId: dto.imageFileId ?? null,
        distanceHint: dto.distanceHint?.trim() || null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async remove(id: string) {
    const exists = await this.prisma.discoverPlace.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Discover place not found');
    return this.prisma.discoverPlace.delete({ where: { id } });
  }
}
