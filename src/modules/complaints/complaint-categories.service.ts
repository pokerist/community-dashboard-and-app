import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ComplaintCategoryItemDto } from './dto/complaint-response.dto';
import { CreateComplaintCategoryDto } from './dto/create-complaint-category.dto';
import { UpdateComplaintCategoryDto } from './dto/update-complaint-category.dto';

@Injectable()
export class ComplaintCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(row: {
    id: string;
    name: string;
    slaHours: number;
    description: string | null;
    isActive: boolean;
    displayOrder: number;
    defaultAssigneeId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ComplaintCategoryItemDto {
    return {
      id: row.id,
      name: row.name,
      slaHours: row.slaHours,
      description: row.description,
      isActive: row.isActive,
      displayOrder: row.displayOrder,
      defaultAssigneeId: row.defaultAssigneeId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listCategories(includeInactive = false): Promise<ComplaintCategoryItemDto[]> {
    const rows = await this.prisma.complaintCategory.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });

    return rows.map((row) => this.toDto(row));
  }

  async createCategory(
    dto: CreateComplaintCategoryDto,
  ): Promise<ComplaintCategoryItemDto> {
    const existing = await this.prisma.complaintCategory.findUnique({
      where: { name: dto.name.trim() },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Complaint category name must be unique');
    }

    const created = await this.prisma.complaintCategory.create({
      data: {
        name: dto.name.trim(),
        slaHours: dto.slaHours,
        description: dto.description?.trim() || null,
        defaultAssigneeId: dto.defaultAssigneeId ?? null,
      },
    });

    return this.toDto(created);
  }

  async updateCategory(
    id: string,
    dto: UpdateComplaintCategoryDto,
  ): Promise<ComplaintCategoryItemDto> {
    const category = await this.prisma.complaintCategory.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundException(`Complaint category ${id} not found`);
    }

    if (dto.name) {
      const existing = await this.prisma.complaintCategory.findFirst({
        where: {
          id: { not: id },
          name: dto.name.trim(),
        },
        select: { id: true },
      });
      if (existing) {
        throw new BadRequestException('Complaint category name must be unique');
      }
    }

    const updated = await this.prisma.complaintCategory.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        slaHours: dto.slaHours,
        description:
          dto.description === undefined ? undefined : dto.description.trim() || null,
        defaultAssigneeId:
          dto.defaultAssigneeId === undefined ? undefined : dto.defaultAssigneeId ?? null,
      },
    });

    return this.toDto(updated);
  }

  async toggleCategory(id: string): Promise<ComplaintCategoryItemDto> {
    const category = await this.prisma.complaintCategory.findUnique({
      where: { id },
      select: { isActive: true },
    });
    if (!category) {
      throw new NotFoundException(`Complaint category ${id} not found`);
    }

    const updated = await this.prisma.complaintCategory.update({
      where: { id },
      data: { isActive: !category.isActive },
    });

    return this.toDto(updated);
  }

  async reorderCategories(orderedIds: string[]): Promise<ComplaintCategoryItemDto[]> {
    const uniqueIds = Array.from(new Set(orderedIds));
    if (uniqueIds.length !== orderedIds.length) {
      throw new BadRequestException('orderedIds must not contain duplicates');
    }

    const existingRows = await this.prisma.complaintCategory.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });

    if (existingRows.length !== uniqueIds.length) {
      throw new BadRequestException('One or more complaint categories were not found');
    }

    await this.prisma.$transaction(
      uniqueIds.map((categoryId, index) =>
        this.prisma.complaintCategory.update({
          where: { id: categoryId },
          data: { displayOrder: index },
        }),
      ),
    );

    return this.listCategories(true);
  }
}
