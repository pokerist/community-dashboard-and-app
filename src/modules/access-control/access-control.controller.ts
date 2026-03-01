import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AccessControlService } from './access-control.service';
import { CreateAccessQrCodeDto } from './dto/create-access-qr-code.dto';
import { ListAccessQrCodesDto } from './dto/list-access-qr-codes.dto';
import { RejectWorkerQrDto } from './dto/reject-worker-qr.dto';
import { MarkQrUsedDto } from './dto/mark-qr-used.dto';

@ApiTags('AccessControl')
@Controller('access-qrcodes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AccessControlController {
  constructor(private readonly accessControlService: AccessControlService) {}

  @Post()
  @ApiOperation({ summary: 'Generate an access QR code (HikCentral-backed)' })
  generate(@Body() dto: CreateAccessQrCodeDto, @Req() req: any) {
    return this.accessControlService.generateQrCode(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List QR codes (by unit or by creator)' })
  list(@Query() query: ListAccessQrCodesDto, @Req() req: any) {
    return this.accessControlService.listQrCodes(
      req.user.id,
      query.unitId,
      query.includeInactive,
    );
  }

  @Patch(':id/revoke')
  @ApiOperation({ summary: 'Revoke an ACTIVE QR code' })
  revoke(@Param('id') id: string, @Req() req: any) {
    return this.accessControlService.revokeQrCode(req.user.id, id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a pending WORKER permit and generate final QR' })
  approveWorkerQr(@Param('id') id: string, @Req() req: any) {
    return this.accessControlService.approveWorkerQrCode(req.user.id, id);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a pending WORKER permit' })
  rejectWorkerQr(
    @Param('id') id: string,
    @Body() dto: RejectWorkerQrDto,
    @Req() req: any,
  ) {
    return this.accessControlService.rejectWorkerQrCode(
      req.user.id,
      id,
      dto.reason,
    );
  }

  @Patch(':id/mark-used')
  @ApiOperation({
    summary:
      'Mark an ACTIVE QR as USED (scan simulation/integration hook) and notify owner',
  })
  markUsed(
    @Param('id') id: string,
    @Body() dto: MarkQrUsedDto,
    @Req() req: any,
  ) {
    return this.accessControlService.markQrCodeUsed(req.user.id, id, dto);
  }
}

