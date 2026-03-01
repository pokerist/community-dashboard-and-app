import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpsertHelpCenterEntryDto } from './dto/help-center.dto';

@Injectable()
export class HelpCenterService {
  constructor(private readonly prisma: PrismaService) {}

  listPublic() {
    return this.prisma.helpCenterEntry.findMany({
      where: { isActive: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
  }

  listAdmin() {
    return this.prisma.helpCenterEntry.findMany({
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
  }

  create(dto: UpsertHelpCenterEntryDto) {
    return this.prisma.helpCenterEntry.create({
      data: {
        title: dto.title.trim(),
        phone: dto.phone.trim(),
        availability: dto.availability?.trim() || null,
        priority: dto.priority ?? 100,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpsertHelpCenterEntryDto) {
    const exists = await this.prisma.helpCenterEntry.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Help center entry not found');

    return this.prisma.helpCenterEntry.update({
      where: { id },
      data: {
        title: dto.title.trim(),
        phone: dto.phone.trim(),
        availability: dto.availability?.trim() || null,
        priority: dto.priority ?? 100,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async remove(id: string) {
    const exists = await this.prisma.helpCenterEntry.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Help center entry not found');
    return this.prisma.helpCenterEntry.delete({ where: { id } });
  }
}
