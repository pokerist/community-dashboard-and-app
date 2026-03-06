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
import { ApprovePermitDto } from './dto/approve-permit.dto';
import { CreatePermitRequestDto } from './dto/create-permit-request.dto';
import { ListPermitRequestsQueryDto } from './dto/list-permit-requests-query.dto';
import { RejectPermitDto } from './dto/reject-permit.dto';
import { PermitsService } from './permits.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

@ApiBearerAuth()
@ApiTags('Permits')
@Controller('permits')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermitsController {
  constructor(private readonly permitsService: PermitsService) {}

  @Get()
  @ApiOperation({ summary: 'List permit requests' })
  @Permissions('service_request.view_all')
  listPermitRequests(@Query() query: ListPermitRequestsQueryDto) {
    return this.permitsService.listPermitRequests(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get permit requests statistics' })
  @Permissions('service_request.view_all')
  getPermitStats() {
    return this.permitsService.getPermitStats();
  }

  @Get(':id([0-9a-fA-F-]{36})')
  @ApiOperation({ summary: 'Get permit request detail' })
  @Permissions('service_request.view_all', 'service_request.view_own')
  getPermitRequestDetail(@Param('id') id: string) {
    return this.permitsService.getPermitRequestDetail(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create permit request' })
  @Permissions('service_request.create')
  createPermitRequest(
    @Body() dto: CreatePermitRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.permitsService.createPermitRequest(req.user.id, dto);
  }

  @Post(':id([0-9a-fA-F-]{36})/approve')
  @ApiOperation({ summary: 'Approve permit request' })
  @Permissions('service_request.resolve')
  approveRequest(
    @Param('id') id: string,
    @Body() dto: ApprovePermitDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.permitsService.approveRequest(id, req.user.id, dto);
  }

  @Post(':id([0-9a-fA-F-]{36})/reject')
  @ApiOperation({ summary: 'Reject permit request' })
  @Permissions('service_request.resolve')
  rejectRequest(
    @Param('id') id: string,
    @Body() dto: RejectPermitDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.permitsService.rejectRequest(id, req.user.id, dto);
  }
}
