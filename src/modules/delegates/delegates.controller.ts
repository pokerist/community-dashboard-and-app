import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DelegatesService } from './delegates.service';
import { CreateDelegateDto } from './dto/create-delegate.dto';
import { CreateDelegateByContactDto } from './dto/create-delegate-by-contact.dto';
import { UpdateDelegateDto } from './dto/update-delegate.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Delegates')
@Controller('delegates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class DelegatesController {
  constructor(private readonly delegatesService: DelegatesService) {}

  @Post('request')
  @Permissions('delegate.create')
  @ApiOperation({ summary: 'Owner requests delegate access for a unit' })
  createRequest(@Body() dto: CreateDelegateDto, @Req() req: any) {
    return this.delegatesService.createDelegateRequest(dto, req.user.id);
  }

  @Post('request-by-contact')
  @Permissions('delegate.create')
  @ApiOperation({
    summary:
      'Owner requests delegate access by contact info (creates invited user if needed)',
  })
  createRequestByContact(@Body() dto: CreateDelegateByContactDto, @Req() req: any) {
    return this.delegatesService.createDelegateRequestByContact(dto, req.user.id);
  }

  @Post(':id/approve')
  @Permissions('delegate.approve')
  @ApiOperation({ summary: 'Admin approves a pending delegate request' })
  approve(@Param('id') id: string, @Req() req: any) {
    return this.delegatesService.approveDelegate(id, req.user.id);
  }

  @Post(':id/revoke')
  @Permissions('delegate.revoke')
  @ApiOperation({ summary: 'Admin/owner revokes delegate access immediately' })
  revoke(@Param('id') id: string, @Req() req: any) {
    return this.delegatesService.revokeDelegate(id, req.user.id);
  }

  @Get('pending')
  @Permissions('delegate.view_all')
  @ApiOperation({ summary: 'Admin lists pending delegate requests' })
  getPendingRequests(@Req() req: any) {
    return this.delegatesService.getPendingRequests(req.user.id);
  }

  @Get('unit/:unitId')
  @Permissions('delegate.view_all', 'delegate.view_own')
  @ApiOperation({ summary: 'Admin/owner lists delegates for a unit' })
  getDelegatesForUnit(@Param('unitId') unitId: string, @Req() req: any) {
    return this.delegatesService.getDelegatesForUnit(unitId, req.user.id);
  }

  @Patch(':id')
  @Permissions('delegate.update')
  @ApiOperation({ summary: 'Admin/owner updates delegate permissions/dates' })
  update(@Param('id') id: string, @Body() dto: UpdateDelegateDto, @Req() req: any) {
    return this.delegatesService.updateDelegate(id, dto, req.user.id);
  }

  @Delete(':id')
  @Permissions('delegate.delete')
  @ApiOperation({ summary: 'Admin hard-deletes a delegate UnitAccess row (use with care)' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.delegatesService.remove(id, req.user.id);
  }
}
