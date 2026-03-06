import {
  Body,
  Controller,
  Get,
  Param,
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
import {
  ListPendingDelegatesQueryDto,
  ListPendingFamilyMembersQueryDto,
  ListPendingHomeStaffQueryDto,
  ListPendingOwnersQueryDto,
} from './dto/approval-query.dto';
import { PreRegisterFamilyMemberDto } from './dto/pre-register-family-member.dto';
import { PreRegisterOwnerDto } from './dto/pre-register-owner.dto';
import { RejectDto } from './dto/reject.dto';
import { ApprovalsService } from './approvals.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

@ApiTags('Approvals')
@ApiBearerAuth()
@Controller('approvals')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get('stats')
  @Permissions('admin.view')
  @ApiOperation({ summary: 'Get unified pending approvals stats' })
  getApprovalStats() {
    return this.approvalsService.getApprovalStats();
  }

  @Get('owners')
  @Permissions('admin.view')
  @ApiOperation({ summary: 'List pending owner registrations' })
  listPendingOwners(@Query() query: ListPendingOwnersQueryDto) {
    return this.approvalsService.listPendingOwners(query);
  }

  @Get('family-members')
  @Permissions('admin.view')
  @ApiOperation({ summary: 'List family member approval queue' })
  listPendingFamilyMembers(@Query() query: ListPendingFamilyMembersQueryDto) {
    return this.approvalsService.listPendingFamilyMembers(query);
  }

  @Get('delegates')
  @Permissions('admin.view')
  @ApiOperation({ summary: 'List delegates approval queue' })
  listPendingDelegates(@Query() query: ListPendingDelegatesQueryDto) {
    return this.approvalsService.listPendingDelegates(query);
  }

  @Get('home-staff')
  @Permissions('admin.view')
  @ApiOperation({ summary: 'List home staff approval queue' })
  listPendingHomeStaff(@Query() query: ListPendingHomeStaffQueryDto) {
    return this.approvalsService.listPendingHomeStaff(query);
  }

  @Post('owners/:id/approve')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Approve owner registration' })
  approveOwnerRegistration(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.approvalsService.approveOwnerRegistration(id, req.user.id);
  }

  @Post('owners/:id/reject')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Reject owner registration' })
  rejectOwnerRegistration(
    @Param('id') id: string,
    @Body() dto: RejectDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.approvalsService.rejectOwnerRegistration(id, req.user.id, dto.reason);
  }

  @Post('family-members/:id/approve')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Approve family member request' })
  approveFamilyMember(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.approvalsService.approveFamilyMember(id, req.user.id);
  }

  @Post('family-members/:id/reject')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Reject family member request' })
  rejectFamilyMember(
    @Param('id') id: string,
    @Body() dto: RejectDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.approvalsService.rejectFamilyMember(id, req.user.id, dto.reason);
  }

  @Post('delegates/:id/approve')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Approve delegate request' })
  approveDelegate(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.approvalsService.approveDelegate(id, req.user.id);
  }

  @Post('delegates/:id/reject')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Reject delegate request' })
  rejectDelegate(
    @Param('id') id: string,
    @Body() dto: RejectDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.approvalsService.rejectDelegate(id, req.user.id, dto.reason);
  }

  @Post('home-staff/:id/approve')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Approve home staff request' })
  approveHomeStaff(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.approvalsService.approveHomeStaff(id, req.user.id);
  }

  @Post('home-staff/:id/reject')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Reject home staff request' })
  rejectHomeStaff(
    @Param('id') id: string,
    @Body() dto: RejectDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.approvalsService.rejectHomeStaff(id, req.user.id, dto.reason);
  }

  @Post('pre-register/owner')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Pre-register owner account' })
  preRegisterOwner(
    @Body() dto: PreRegisterOwnerDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.approvalsService.preRegisterOwner(dto, req.user.id);
  }

  @Post('pre-register/family-member')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Pre-register family member account' })
  preRegisterFamilyMember(
    @Body() dto: PreRegisterFamilyMemberDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.approvalsService.preRegisterFamilyMember(dto, req.user.id);
  }
}

