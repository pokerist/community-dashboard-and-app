import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateViolationCategoryDto } from './dto/create-violation-category.dto';
import { UpdateViolationCategoryDto } from './dto/update-violation-category.dto';
import { ViolationCategoryItemDto } from './dto/violation-response.dto';

@Injectable()
export class ViolationCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(row: {
    id: string;
    name: string;
    defaultFineAmount: { toNumber: () => number };
    description: string | null;
    isActive: boolean;
    displayOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }): ViolationCategoryItemDto {
    return {
      id: row.id,
      name: row.name,
      defaultFineAmount: row.defaultFineAmount.toNumber(),
      description: row.description,
      isActive: row.isActive,
      displayOrder: row.displayOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listCategories(includeInactive = false): Promise<ViolationCategoryItemDto[]> {
    const rows = await this.prisma.violationCategory.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });

    return rows.map((row) => this.toDto(row));
  }

  async createCategory(
    dto: CreateViolationCategoryDto,
  ): Promise<ViolationCategoryItemDto> {
    const name = dto.name.trim();
    const existing = await this.prisma.violationCategory.findUnique({
      where: { name },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Violation category name must be unique');
    }

    const created = await this.prisma.violationCategory.create({
      data: {
        name,
        defaultFineAmount: dto.defaultFineAmount,
        description: dto.description?.trim() || null,
      },
    });

    return this.toDto(created);
  }

  async updateCategory(
    id: string,
    dto: UpdateViolationCategoryDto,
  ): Promise<ViolationCategoryItemDto> {
    const existing = await this.prisma.violationCategory.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(`Violation category ${id} not found`);
    }

    if (dto.name) {
      const nameTaken = await this.prisma.violationCategory.findFirst({
        where: {
          id: { not: id },
          name: dto.name.trim(),
        },
        select: { id: true },
      });
      if (nameTaken) {
        throw new BadRequestException('Violation category name must be unique');
      }
    }

    const updated = await this.prisma.violationCategory.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        defaultFineAmount: dto.defaultFineAmount,
        description:
          dto.description === undefined ? undefined : dto.description.trim() || null,
      },
    });

    return this.toDto(updated);
  }

  async toggleCategory(id: string): Promise<ViolationCategoryItemDto> {
    const category = await this.prisma.violationCategory.findUnique({
      where: { id },
      select: { isActive: true },
    });
    if (!category) {
      throw new NotFoundException(`Violation category ${id} not found`);
    }

    const updated = await this.prisma.violationCategory.update({
      where: { id },
      data: {
        isActive: !category.isActive,
      },
    });

    return this.toDto(updated);
  }

  async reorderCategories(orderedIds: string[]): Promise<ViolationCategoryItemDto[]> {
    const uniqueIds = Array.from(new Set(orderedIds));
    if (uniqueIds.length !== orderedIds.length) {
      throw new BadRequestException('orderedIds must not contain duplicates');
    }

    const rows = await this.prisma.violationCategory.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    if (rows.length !== uniqueIds.length) {
      throw new BadRequestException('One or more violation categories were not found');
    }

    await this.prisma.$transaction(
      uniqueIds.map((categoryId, index) =>
        this.prisma.violationCategory.update({
          where: { id: categoryId },
          data: { displayOrder: index },
        }),
      ),
    );

    return this.listCategories(true);
  }
}
