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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ListLeasesDto } from './dto/list-leases.dto';
import { ListRentRequestsDto } from './dto/list-rent-requests.dto';
import { RejectRentRequestDto } from './dto/reject-rent-request.dto';
import { RentalSettingsQueryDto } from './dto/rental-settings-query.dto';
import { RenewLeaseDto } from './dto/renew-lease.dto';
import { TerminateLeaseDto } from './dto/terminate-lease.dto';
import { ToggleLeasingDto } from './dto/toggle-leasing.dto';
import { RentalService } from './rental.service';

@ApiTags('Rental')
@ApiBearerAuth()
@Controller('rental')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RentalController {
  constructor(private readonly rentalService: RentalService) {}

  @Get('settings')
  @Permissions('admin.view')
  getRentalSettings(@Query() query: RentalSettingsQueryDto) {
    return this.rentalService.getRentalSettings(query.communityId);
  }

  @Patch('settings/toggle')
  @Permissions('admin.update')
  toggleLeasingOperations(@Body() dto: ToggleLeasingDto, @Req() req: { user: { id: string } }) {
    return this.rentalService.toggleLeasingOperations(dto, req.user.id);
  }

  @Get('stats')
  @Permissions('admin.view')
  getRentalStats() {
    return this.rentalService.getRentalStats();
  }

  @Get('leases')
  @Permissions('admin.view')
  listLeases(@Query() query: ListLeasesDto) {
    return this.rentalService.listLeases(query);
  }

  @Get('leases/:id')
  @Permissions('admin.view')
  getLeaseDetail(@Param('id') id: string) {
    return this.rentalService.getLeaseDetail(id);
  }

  @Post('leases/:id/renew')
  @Permissions('admin.update')
  renewLease(
    @Param('id') id: string,
    @Body() dto: RenewLeaseDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.rentalService.renewLease(id, dto, req.user.id);
  }

  @Post('leases/:id/terminate')
  @Permissions('admin.update')
  terminateLease(
    @Param('id') id: string,
    @Body() dto: TerminateLeaseDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.rentalService.terminateLease(id, dto, req.user.id);
  }

  @Get('requests')
  @Permissions('admin.view')
  listRentRequests(@Query() query: ListRentRequestsDto) {
    return this.rentalService.listRentRequests(query);
  }

  @Post('requests/:id/approve')
  @Permissions('admin.update')
  approveRentRequest(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.rentalService.approveRentRequest(id, req.user.id);
  }

  @Post('requests/:id/reject')
  @Permissions('admin.update')
  rejectRentRequest(
    @Param('id') id: string,
    @Body() dto: RejectRentRequestDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.rentalService.rejectRentRequest(id, dto, req.user.id);
  }
}

