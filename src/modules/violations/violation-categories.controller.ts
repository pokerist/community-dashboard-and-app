import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreateViolationCategoryDto } from './dto/create-violation-category.dto';
import { ListViolationCategoriesQueryDto } from './dto/list-violation-categories-query.dto';
import { ReorderViolationCategoriesDto } from './dto/reorder-violation-categories.dto';
import { UpdateViolationCategoryDto } from './dto/update-violation-category.dto';
import { ViolationCategoriesService } from './violation-categories.service';

@ApiBearerAuth()
@ApiTags('Violation Categories')
@Controller('violation-categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ViolationCategoriesController {
  constructor(private readonly violationCategoriesService: ViolationCategoriesService) {}

  @Get()
  @Permissions('violation.view_all', 'violation.update')
  listCategories(@Query() query: ListViolationCategoriesQueryDto) {
    return this.violationCategoriesService.listCategories(query.includeInactive);
  }

  @Post()
  @Permissions('violation.update')
  createCategory(@Body() dto: CreateViolationCategoryDto) {
    return this.violationCategoriesService.createCategory(dto);
  }

  @Patch('reorder')
  @Permissions('violation.update')
  reorderCategories(@Body() dto: ReorderViolationCategoriesDto) {
    return this.violationCategoriesService.reorderCategories(dto.orderedIds);
  }

  @Patch(':id')
  @Permissions('violation.update')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateViolationCategoryDto) {
    return this.violationCategoriesService.updateCategory(id, dto);
  }

  @Patch(':id/toggle')
  @Permissions('violation.update')
  toggleCategory(@Param('id') id: string) {
    return this.violationCategoriesService.toggleCategory(id);
  }
}
