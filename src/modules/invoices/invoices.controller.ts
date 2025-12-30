// src/modules/invoices/invoices.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  MarkAsPaidDto,
} from './dto/invoices.dto';
import { CreateUnitFeeDto, UpdateUnitFeeDto } from './dto/unit-fees.dto';
import { GenerateUtilityInvoicesDto } from './dto/generate-invoice.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  // POST /invoices/generate (Admin: Manually trigger monthly utility billing)
  @Post('generate')
  @Permissions('invoice.generate')
  @ApiOperation({
    summary: 'Generates invoices for all un-invoiced fees for a given month.',
    description:
      'Trigger the monthly utility billing job based on UnitFee records.',
  })
  generateUtilityInvoices(@Body() dto: GenerateUtilityInvoicesDto) {
    return this.invoicesService.generateMonthlyUtilityInvoices(
      new Date(dto.billingMonth),
    );
  }

  // GET /invoices/resident/:residentId (Community App: Resident view)
  @Get('resident/:residentId')
  @Permissions('invoice.view_all', 'invoice.view_own')
  findByResident(@Param('residentId') residentId: string) {
    return this.invoicesService.findByResident(residentId);
  }

  // GET /invoices/fees (Admin: List all fee records)
  @Get('fees')
  @ApiOperation({ summary: 'Lists all individual UnitFee records.' })
  @Permissions('unit_fee.view_all', 'unit_fee.view_own')
  findAllUnitFees() {
    return this.invoicesService.findAllUnitFees();
  }

  // POST /invoices/fees (Admin: Input new variable fee record)
  @Post('fees')
  @Permissions('unit_fee.create')
  @ApiOperation({ summary: 'Creates a single variable fee record for a unit.' })
  createUnitFee(@Body() createUnitFeeDto: CreateUnitFeeDto) {
    return this.invoicesService.createUnitFee(createUnitFeeDto);
  }

  // DELETE /invoices/fees/:id (Admin: Delete an un-invoiced fee record)
  @Delete('fees/:id')
  @Permissions('unit_fee.delete')
  @ApiOperation({ summary: 'Deletes a UnitFee record before it is invoiced.' })
  removeUnitFee(@Param('id') id: string) {
    return this.invoicesService.removeUnitFee(id);
  }

  // GET /invoices (Admin: List all invoices)
  @Get()
  @Permissions('invoice.view_all')
  findAll() {
    return this.invoicesService.findAll();
  }

  // GET /invoices/:id
  @Get(':id')
  @Permissions('invoice.view_all', 'invoice.view_own')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  // POST /invoices (Admin: Manual invoice creation) 
  @Post()
  @Permissions('invoice.create')
  create(@Body() createInvoiceDto: CreateInvoiceDto) {
    const payload: CreateInvoiceDto = {
      ...createInvoiceDto,
      dueDate: new Date(createInvoiceDto.dueDate as unknown as string),
    };
    return this.invoicesService.create(payload);
  }

  // PATCH /invoices/:id (Admin: Update details like due date or amount)
  @Patch(':id')
  @Permissions('invoice.update')
  update(@Param('id') id: string, @Body() updateInvoiceDto: UpdateInvoiceDto) {
    return this.invoicesService.update(id, updateInvoiceDto);
  }

  // POST /invoices/:id/pay (Workflow: Mark as paid)
  @Post(':id/pay')
  @Permissions('invoice.mark_paid')
  markAsPaid(@Param('id') id: string, @Body() markAsPaidDto: MarkAsPaidDto) {
    // You can use the DTO here to process payment details if needed
    return this.invoicesService.markAsPaid(id);
  }

  // DELETE /invoices/:id (Admin: Cancel/Delete)
  @Delete(':id')
  @Permissions('invoice.delete')
  remove(@Param('id') id: string) {
    return this.invoicesService.remove(id);
  }
}
