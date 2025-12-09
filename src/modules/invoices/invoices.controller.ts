// src/modules/invoices/invoices.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  BadRequestException,
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

@ApiTags('Invoices')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}
  // POST /invoices/generate (Admin: Manually trigger monthly utility billing)
  @Post('generate')
  @ApiOperation({
    summary: 'Generates invoices for all un-invoiced fees for a given month.',
    description:
      'Trigger the monthly utility billing job based on UnitFee records.',
  })
  // FIX: Use the new DTO for the request body
  generateUtilityInvoices(@Body() dto: GenerateUtilityInvoicesDto) {
    // FIX: Convert the DTO string to a Date object before passing to the service
    return this.invoicesService.generateMonthlyUtilityInvoices(
      new Date(dto.billingMonth),
    );
  }

  // GET /invoices/resident/:residentId (Community App: Resident view)
  @Get('resident/:residentId')
  findByResident(@Param('residentId') residentId: string) {
    return this.invoicesService.findByResident(residentId);
  }

  // GET /invoices/fees (Admin: List all fee records)
  @Get('fees')
  @ApiOperation({ summary: 'Lists all individual UnitFee records.' })
  findAllUnitFees() {
    return this.invoicesService.findAllUnitFees();
  }

  // POST /invoices/fees (Admin: Input new variable fee record)
  @Post('fees')
  @ApiOperation({ summary: 'Creates a single variable fee record for a unit.' })
  createUnitFee(@Body() createUnitFeeDto: CreateUnitFeeDto) {
    return this.invoicesService.createUnitFee(createUnitFeeDto);
  }

  // DELETE /invoices/fees/:id (Admin: Delete an un-invoiced fee record)
  @Delete('fees/:id')
  @ApiOperation({ summary: 'Deletes a UnitFee record before it is invoiced.' })
  removeUnitFee(@Param('id') id: string) {
    return this.invoicesService.removeUnitFee(id);
  }

  // GET /invoices (Admin: List all invoices)
  @Get()
  findAll() {
    return this.invoicesService.findAll();
  }

  // GET /invoices/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  // POST /invoices (Admin: Manual invoice creation)
  @Post()
  create(@Body() createInvoiceDto: CreateInvoiceDto) {
    const payload: CreateInvoiceDto = {
      ...createInvoiceDto,
      dueDate: new Date(createInvoiceDto.dueDate as unknown as string),
    };
    return this.invoicesService.create(payload);
  }

  // PATCH /invoices/:id (Admin: Update details like due date or amount)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateInvoiceDto: UpdateInvoiceDto) {
    return this.invoicesService.update(id, updateInvoiceDto);
  }

  // POST /invoices/:id/pay (Workflow: Mark as paid)
  @Post(':id/pay')
  markAsPaid(@Param('id') id: string, @Body() markAsPaidDto: MarkAsPaidDto) {
    // You can use the DTO here to process payment details if needed
    return this.invoicesService.markAsPaid(id);
  }

  // DELETE /invoices/:id (Admin: Cancel/Delete)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.invoicesService.remove(id);
  }
}
