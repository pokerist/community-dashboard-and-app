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
import { Request } from 'express';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AddInternalNoteDto } from './dto/add-internal-note.dto';
import { AssignRequestDto } from './dto/assign-request.dto';
import { CancelServiceRequestDto } from './dto/cancel-service-request.dto';
import { CreateServiceRequestCommentDto } from './dto/create-service-request-comment.dto';
import { CreateRequestInvoiceDto } from './dto/create-request-invoice.dto';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { ListServiceRequestsQueryDto } from './dto/list-service-requests-query.dto';
import { SubmitRatingDto } from './dto/submit-rating.dto';
import { UpdateRequestStatusDto } from './dto/update-request-status.dto';
import { UpdateServiceRequestInternalDto } from './dto/update-service-request-internal.dto';
import { ServiceRequestService } from './service-request.service';

interface AuthenticatedUser {
  id: string;
  permissions?: string[];
  roles?: string[];
}

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@ApiBearerAuth()
@ApiTags('Service Requests')
@Controller('service-requests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ServiceRequestController {
  constructor(private readonly serviceRequestService: ServiceRequestService) {}

  @Post()
  @ApiOperation({ summary: 'Create a service request' })
  @Permissions('service_request.create')
  create(@Body() dto: CreateServiceRequestDto, @Req() req: AuthenticatedRequest) {
    return this.serviceRequestService.create(req.user.id, dto);
  }

  @Get('my-requests')
  @ApiOperation({ summary: 'List current user service requests' })
  @Permissions('service_request.view_own')
  findByUser(
    @Req() req: AuthenticatedRequest,
    @Query('kind') kind?: 'services' | 'requests' | 'all',
  ) {
    return this.serviceRequestService.findByUser(req.user.id, kind);
  }

  @Post('check-sla')
  @ApiOperation({ summary: 'Run SLA breach checker manually' })
  @Permissions('service_request.view_all')
  async checkSlaBreaches() {
    const count = await this.serviceRequestService.checkSlaBreaches();
    return { count };
  }

  @Get()
  @ApiOperation({ summary: 'List service requests (admin view)' })
  @Permissions('service_request.view_all')
  listRequests(@Query() query: ListServiceRequestsQueryDto) {
    return this.serviceRequestService.listRequests(query);
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign a service request to staff user' })
  @Permissions('service_request.assign')
  assignRequest(
    @Param('id') id: string,
    @Body() dto: AssignRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.serviceRequestService.assignRequest(id, dto, req.user.id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update service request status with transition validation' })
  @Permissions('service_request.assign', 'service_request.resolve', 'service_request.close')
  updateRequestStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRequestStatusDto,
  ) {
    return this.serviceRequestService.updateRequestStatus(id, dto);
  }

  @Post(':id/note')
  @ApiOperation({ summary: 'Append internal note on request' })
  @Permissions('service_request.assign', 'service_request.resolve', 'service_request.close')
  addInternalNote(
    @Param('id') id: string,
    @Body() dto: AddInternalNoteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.serviceRequestService.addInternalNote(id, dto.note, req.user.id);
  }

  @Post(':id/rating')
  @ApiOperation({ summary: 'Submit customer rating for resolved/closed request' })
  @Permissions('service_request.view_own', 'service_request.view_all')
  submitRating(
    @Param('id') id: string,
    @Body() dto: SubmitRatingDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.serviceRequestService.submitRating(id, req.user.id, dto);
  }

  @Post(':id/invoices')
  @ApiOperation({ summary: 'Create invoice linked to a service request' })
  @Permissions('invoice.create')
  createInvoice(
    @Param('id') id: string,
    @Body() dto: CreateRequestInvoiceDto,
  ) {
    return this.serviceRequestService.createInvoiceForRequest(
      id,
      dto.amount,
      new Date(dto.dueDate),
    );
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'List request comments' })
  @Permissions('service_request.view_own', 'service_request.view_all')
  listComments(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.serviceRequestService.listCommentsForActor(id, {
      actorUserId: req.user.id,
      permissions: Array.isArray(req.user.permissions) ? req.user.permissions : [],
      roles: Array.isArray(req.user.roles) ? req.user.roles : [],
    });
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add request comment' })
  @Permissions('service_request.view_own', 'service_request.view_all')
  addComment(
    @Param('id') id: string,
    @Body() dto: CreateServiceRequestCommentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.serviceRequestService.addCommentForActor(id, dto, {
      actorUserId: req.user.id,
      permissions: Array.isArray(req.user.permissions) ? req.user.permissions : [],
      roles: Array.isArray(req.user.roles) ? req.user.roles : [],
    });
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a new request by requester' })
  @Permissions('service_request.view_own')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelServiceRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.serviceRequestService.cancelForActor(id, dto, {
      actorUserId: req.user.id,
      permissions: Array.isArray(req.user.permissions) ? req.user.permissions : [],
      roles: Array.isArray(req.user.roles) ? req.user.roles : [],
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Legacy internal update endpoint (assign/status)' })
  @Permissions('service_request.assign', 'service_request.resolve', 'service_request.close')
  updateLegacy(
    @Param('id') id: string,
    @Body() dto: UpdateServiceRequestInternalDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.serviceRequestService.updateForActor(id, dto, {
      actorUserId: req.user.id,
      permissions: Array.isArray(req.user.permissions) ? req.user.permissions : [],
      roles: Array.isArray(req.user.roles) ? req.user.roles : [],
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get service request detail' })
  @Permissions('service_request.view_own', 'service_request.view_all')
  getRequestDetail(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.serviceRequestService.findOneForActor(id, {
      actorUserId: req.user.id,
      permissions: Array.isArray(req.user.permissions) ? req.user.permissions : [],
      roles: Array.isArray(req.user.roles) ? req.user.roles : [],
    });
  }
}
