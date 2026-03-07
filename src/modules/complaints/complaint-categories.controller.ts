import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ComplaintCategoriesService } from './complaint-categories.service';
import { CreateComplaintCategoryDto } from './dto/create-complaint-category.dto';
import { ListComplaintCategoriesQueryDto } from './dto/list-complaint-categories-query.dto';
import { ReorderComplaintCategoriesDto } from './dto/reorder-complaint-categories.dto';
import { UpdateComplaintCategoryDto } from './dto/update-complaint-category.dto';

@ApiBearerAuth()
@ApiTags('Complaint Categories')
@Controller('complaint-categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ComplaintCategoriesController {
  constructor(private readonly complaintCategoriesService: ComplaintCategoriesService) {}

  @Get()
  @Permissions('complaint.view_all', 'complaint.manage')
  listCategories(@Query() query: ListComplaintCategoriesQueryDto) {
    return this.complaintCategoriesService.listCategories(query.includeInactive);
  }

  @Post()
  @Permissions('complaint.manage')
  createCategory(@Body() dto: CreateComplaintCategoryDto) {
    return this.complaintCategoriesService.createCategory(dto);
  }

  @Patch('reorder')
  @Permissions('complaint.manage')
  reorderCategories(@Body() dto: ReorderComplaintCategoriesDto) {
    return this.complaintCategoriesService.reorderCategories(dto.orderedIds);
  }

  @Patch(':id')
  @Permissions('complaint.manage')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateComplaintCategoryDto) {
    return this.complaintCategoriesService.updateCategory(id, dto);
  }

  @Patch(':id/toggle')
  @Permissions('complaint.manage')
  toggleCategory(@Param('id') id: string) {
    return this.complaintCategoriesService.toggleCategory(id);
  }
}
