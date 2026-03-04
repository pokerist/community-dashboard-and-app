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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { CreateServiceRequestCommentDto } from './dto/create-service-request-comment.dto';
import { CancelServiceRequestDto } from './dto/cancel-service-request.dto';
import { UpdateServiceRequestInternalDto } from './dto/update-service-request-internal.dto';
import { ServiceRequestService } from './service-request.service';

@ApiBearerAuth()
@ApiTags('Service Requests')
@Controller('service-requests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ServiceRequestController {
  constructor(private readonly serviceRequestService: ServiceRequestService) {}

  /** POST /service-requests
  Used by the Community App (resident) to create a new request.
  */
  @Post()
  @ApiOperation({
    summary: 'Create a service request',
    description:
      'Creates a service request, optionally linking attachments and submitting dynamic field values.',
  })
  @Permissions('service_request.create')
  create(@Body() dto: CreateServiceRequestDto, @Req() req: any) {
    return this.serviceRequestService.create(req.user.id, dto);
  }

  /** GET /service-requests/my-requests
      Implements the Community App's "My requests" view.
  */
  @Get('my-requests')
  @ApiOperation({
    summary: 'List my service requests',
    description:
      "Returns the authenticated user's service requests ordered by most recent first.",
  })
  @Permissions('service_request.view_own')
  findByUser(@Req() req: any, @Query('kind') kind?: 'services' | 'requests' | 'all') {
    return this.serviceRequestService.findByUser(req.user.id, kind);
  }

  /** GET /service-requests
      Dashboard/staff view: list all requests.
  */
  @Get()
  @ApiOperation({
    summary: 'List all service requests (dashboard)',
    description: 'Returns all service requests for dashboard/staff workflows.',
  })
  @Permissions('service_request.view_all')
  findAll(@Query('kind') kind?: 'services' | 'requests' | 'all') {
    return this.serviceRequestService.findAll(kind);
  }

  /** GET /service-requests/:id */
  @Get(':id')
  @ApiOperation({
    summary: 'Get a service request by id',
    description:
      'Returns a single service request including service, attachments, and submitted field values.',
  })
  @Permissions('service_request.view_own', 'service_request.view_all')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.serviceRequestService.findOneForActor(id, {
      actorUserId: req.user.id,
      permissions: Array.isArray(req.user.permissions) ? req.user.permissions : [],
      roles: Array.isArray(req.user.roles) ? req.user.roles : [],
    });
  }

  @Get(':id/comments')
  @ApiOperation({
    summary: 'List service request comments',
    description:
      'Returns comments for a service request. Residents see only non-internal comments.',
  })
  @Permissions('service_request.view_own', 'service_request.view_all')
  listComments(@Param('id') id: string, @Req() req: any) {
    return this.serviceRequestService.listCommentsForActor(id, {
      actorUserId: req.user.id,
      permissions: Array.isArray(req.user.permissions) ? req.user.permissions : [],
      roles: Array.isArray(req.user.roles) ? req.user.roles : [],
    });
  }

  @Post(':id/comments')
  @ApiOperation({
    summary: 'Add a comment to a service request',
    description:
      'Adds a comment to the ticket. Internal comments are restricted to staff/admin users.',
  })
  @Permissions('service_request.view_own', 'service_request.view_all')
  addComment(
    @Param('id') id: string,
    @Body() dto: CreateServiceRequestCommentDto,
    @Req() req: any,
  ) {
    return this.serviceRequestService.addCommentForActor(id, dto, {
      actorUserId: req.user.id,
      permissions: Array.isArray(req.user.permissions) ? req.user.permissions : [],
      roles: Array.isArray(req.user.roles) ? req.user.roles : [],
    });
  }

  @Patch(':id/cancel')
  @ApiOperation({
    summary: 'Cancel my service request',
    description:
      'Allows the requester to cancel a request before it is accepted/in-progress by staff.',
  })
  @Permissions('service_request.view_own')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelServiceRequestDto,
    @Req() req: any,
  ) {
    return this.serviceRequestService.cancelForActor(id, dto, {
      actorUserId: req.user.id,
      permissions: Array.isArray(req.user.permissions) ? req.user.permissions : [],
      roles: Array.isArray(req.user.roles) ? req.user.roles : [],
    });
  }

  /** PATCH /service-requests/:id
      Used by dashboard staff to update status/assignment.
  */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a service request (internal)',
    description:
      'Updates internal processing fields such as status and assignee. Intended for dashboard/staff use.',
  })
  @Permissions(
    'service_request.assign',
    'service_request.resolve',
    'service_request.close',
  )
  update(@Param('id') id: string, @Body() dto: UpdateServiceRequestInternalDto, @Req() req: any) {
    return this.serviceRequestService.updateForActor(id, dto, {
      actorUserId: req.user.id,
      permissions: Array.isArray(req.user.permissions) ? req.user.permissions : [],
      roles: Array.isArray(req.user.roles) ? req.user.roles : [],
    });
  }
}

