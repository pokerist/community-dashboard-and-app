import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import {
  CreateInvoiceCategoryDto,
  ListInvoiceCategoriesDto,
  ReorderInvoiceCategoriesDto,
  UpdateInvoiceCategoryDto,
} from './dto/invoice-categories.dto';
import { InvoiceCategoryService } from './invoice-categories.service';

@ApiTags('Invoice Categories')
@ApiBearerAuth()
@Controller('invoice-categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InvoiceCategoriesController {
  constructor(
    private readonly invoiceCategoryService: InvoiceCategoryService,
  ) {}

  @Get()
  @Permissions('invoice.view_all')
  listCategories(@Query() query: ListInvoiceCategoriesDto) {
    return this.invoiceCategoryService.listCategories(
      query.includeInactive ?? false,
    );
  }

  @Post()
  @Permissions('invoice.create')
  createCategory(@Body() dto: CreateInvoiceCategoryDto) {
    return this.invoiceCategoryService.createCategory(dto);
  }

  @Patch('reorder')
  @Permissions('invoice.update')
  reorderCategories(@Body() dto: ReorderInvoiceCategoriesDto) {
    return this.invoiceCategoryService.reorderCategories(dto.orderedIds);
  }

  @Patch(':id/toggle')
  @Permissions('invoice.update')
  toggleCategory(@Param('id') id: string) {
    return this.invoiceCategoryService.toggleCategory(id);
  }

  @Patch(':id')
  @Permissions('invoice.update')
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceCategoryDto,
  ) {
    return this.invoiceCategoryService.updateCategory(id, dto);
  }
}
