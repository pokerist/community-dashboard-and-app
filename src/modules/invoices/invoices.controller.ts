// src/modules/invoices/invoices.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto, UpdateInvoiceDto, MarkAsPaidDto } from './dto/invoices.dto';

@ApiTags('invoices')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  // POST /invoices (Admin: Manual invoice creation)
  @Post()
  create(@Body() createInvoiceDto: CreateInvoiceDto) {
    return this.invoicesService.create(createInvoiceDto);
  }

  // GET /invoices (Admin: List all invoices)
  @Get()
  findAll() {
    return this.invoicesService.findAll();
  }
  
  // GET /invoices/resident/:residentId (Community App: Resident view)
  @Get('resident/:residentId')
  findByResident(@Param('residentId') residentId: string) {
    return this.invoicesService.findByResident(residentId);
  }

  // GET /invoices/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
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