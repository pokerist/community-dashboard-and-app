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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import {
  CreateAuthorizedRequestDto,
  CreateFamilyRequestDto,
  CreateHomeStaffDto,
  ReviewHouseholdRequestDto,
} from './dto/household-requests.dto';
import { HouseholdService } from './household.service';
import { HouseholdRequestStatus } from '@prisma/client';

@ApiTags('Household')
@ApiBearerAuth()
@Controller('household')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HouseholdController {
  constructor(private readonly householdService: HouseholdService) {}

  @Post('family-requests')
  @Permissions('household.create_request')
  @ApiOperation({ summary: 'Create family member access request (pending admin review)' })
  createFamilyRequest(@Body() dto: CreateFamilyRequestDto, @Req() req: any) {
    return this.householdService.createFamilyRequest(req.user.id, dto);
  }

  @Post('authorized-requests')
  @Permissions('household.create_request')
  @ApiOperation({ summary: 'Create authorized person request (pending admin review)' })
  createAuthorizedRequest(@Body() dto: CreateAuthorizedRequestDto, @Req() req: any) {
    return this.householdService.createAuthorizedRequest(req.user.id, dto);
  }

  @Post('home-staff')
  @Permissions('household.create_request')
  @ApiOperation({ summary: 'Create home staff access request (no mobile account)' })
  createHomeStaff(@Body() dto: CreateHomeStaffDto, @Req() req: any) {
    return this.householdService.createHomeStaffAccess(req.user.id, dto);
  }

  @Get('my-requests')
  @Permissions('household.view_own')
  @ApiOperation({ summary: 'List my household requests by type' })
  listMyRequests(@Req() req: any, @Query('unitId') unitId?: string) {
    return this.householdService.listMyRequests(req.user.id, unitId);
  }

  @Get('admin/requests')
  @ApiOperation({ summary: 'Admin list of household requests' })
  @Permissions('household.view_all')
  listAdminRequests(@Query('status') status?: HouseholdRequestStatus | 'ALL') {
    return this.householdService.listAdminRequests(status);
  }

  @Patch('admin/family-requests/:id/review')
  @ApiOperation({ summary: 'Admin review family request' })
  @Permissions('household.review')
  reviewFamilyRequest(
    @Param('id') id: string,
    @Body() dto: ReviewHouseholdRequestDto,
    @Req() req: any,
  ) {
    return this.householdService.reviewFamilyRequest(id, req.user.id, dto);
  }

  @Patch('admin/authorized-requests/:id/review')
  @ApiOperation({ summary: 'Admin review authorized request' })
  @Permissions('household.review')
  reviewAuthorizedRequest(
    @Param('id') id: string,
    @Body() dto: ReviewHouseholdRequestDto,
    @Req() req: any,
  ) {
    return this.householdService.reviewAuthorizedRequest(id, req.user.id, dto);
  }

  @Patch('admin/home-staff/:id/review')
  @ApiOperation({ summary: 'Admin review home staff request' })
  @Permissions('household.review')
  reviewHomeStaffRequest(
    @Param('id') id: string,
    @Body() dto: ReviewHouseholdRequestDto,
    @Req() req: any,
  ) {
    return this.householdService.reviewHomeStaffRequest(id, req.user.id, dto);
  }
}
