import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { GenerateUtilityInvoicesDto } from './dto/generate-invoice.dto';
import { InvoiceStatsQueryDto, ListInvoicesDto } from './dto/invoice-query.dto';
import {
  CancelInvoiceDto,
  CreateInvoiceDto,
  MarkAsPaidDto,
  SimulateInvoicePaymentDto,
} from './dto/invoices.dto';
import { CreateUnitFeeDto } from './dto/unit-fees.dto';
import { InvoicesService } from './invoices.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    permissions?: unknown;
    roles?: unknown;
  };
}

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post('generate')
  @Permissions('invoice.generate')
  @ApiOperation({
    summary: 'Generates monthly utility invoices from un-invoiced unit fees.',
  })
  generateUtilityInvoices(@Body() dto: GenerateUtilityInvoicesDto) {
    return this.invoicesService.generateMonthlyUtilityInvoices(
      new Date(dto.billingMonth),
    );
  }

  @Get('resident/:residentId')
  @Permissions('invoice.view_all', 'invoice.view_own')
  findByResident(
    @Param('residentId') residentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.invoicesService.findByResidentForActor(
      residentId,
      this.buildActorContext(req),
    );
  }

  @Get('fees')
  @Permissions('unit_fee.view_all', 'unit_fee.view_own')
  findAllUnitFees(@Req() req: AuthenticatedRequest) {
    return this.invoicesService.findAllUnitFeesForActor(
      this.buildActorContext(req),
    );
  }

  @Post('fees')
  @Permissions('unit_fee.create')
  createUnitFee(@Body() createUnitFeeDto: CreateUnitFeeDto) {
    return this.invoicesService.createUnitFee(createUnitFeeDto);
  }

  @Delete('fees/:id')
  @Permissions('unit_fee.delete')
  removeUnitFee(@Param('id') id: string) {
    return this.invoicesService.removeUnitFee(id);
  }

  @Get('stats')
  @Permissions('invoice.view_all')
  getInvoiceStats(@Query() query: InvoiceStatsQueryDto) {
    return this.invoicesService.getInvoiceStats(query);
  }

  @Post('bulk-overdue')
  @Permissions('invoice.update')
  bulkMarkOverdue() {
    return this.invoicesService.bulkMarkOverdue();
  }

  @Get()
  @Permissions('invoice.view_all')
  listInvoices(@Query() query: ListInvoicesDto) {
    return this.invoicesService.listInvoices(query);
  }

  @Get('me')
  @Permissions('invoice.view_own', 'invoice.view_all')
  findMine(@Req() req: AuthenticatedRequest) {
    return this.invoicesService.findMineForActor(this.buildActorContext(req));
  }

  @Get(':id')
  @Permissions('invoice.view_all', 'invoice.view_own')
  getInvoiceDetail(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.invoicesService.findOneForActor(
      id,
      this.buildActorContext(req),
    );
  }

  @Post()
  @Permissions('invoice.create')
  createInvoice(@Body() createInvoiceDto: CreateInvoiceDto) {
    return this.invoicesService.createInvoice(createInvoiceDto);
  }

  @Patch(':id/pay')
  @Permissions('invoice.mark_paid')
  markAsPaid(@Param('id') id: string, @Body() markAsPaidDto: MarkAsPaidDto) {
    return this.invoicesService.markAsPaid(id, markAsPaidDto);
  }

  @Post(':id/pay')
  @Permissions('invoice.mark_paid')
  markAsPaidLegacy(
    @Param('id') id: string,
    @Body() markAsPaidDto: MarkAsPaidDto,
  ) {
    return this.invoicesService.markAsPaid(id, markAsPaidDto);
  }

  @Patch(':id/cancel')
  @Permissions('invoice.update')
  cancelInvoice(@Param('id') id: string, @Body() dto: CancelInvoiceDto) {
    return this.invoicesService.cancelInvoice(id, dto);
  }

  @Post(':id/pay/simulate-self')
  @Permissions('invoice.view_own', 'invoice.view_all')
  @ApiOperation({
    summary:
      'Demo payment simulation for residents. Marks invoice as PAID after actor access checks.',
  })
  simulateSelfPayment(
    @Param('id') id: string,
    @Body() dto: SimulateInvoicePaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.invoicesService.simulatePaymentForActor(
      id,
      dto,
      this.buildActorContext(req),
    );
  }

  @Delete(':id')
  @Permissions('invoice.delete')
  remove(@Param('id') id: string) {
    return this.invoicesService.remove(id);
  }

  private buildActorContext(req: AuthenticatedRequest): {
    actorUserId: string;
    permissions: string[];
    roles: string[];
  } {
    const actorUserId = req.user?.id ?? '';
    const permissions = Array.isArray(req.user?.permissions)
      ? req.user.permissions.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];
    const roles = Array.isArray(req.user?.roles)
      ? req.user.roles.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];

    return {
      actorUserId,
      permissions,
      roles,
    };
  }
}
