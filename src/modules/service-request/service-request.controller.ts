// src/service-request/service-request.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ServiceRequestService } from './service-request.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { UpdateServiceRequestInternalDto } from './dto/update-service-request-internal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiBearerAuth()
@ApiTags('Service Requests')
@Controller('service-requests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ServiceRequestController {
  constructor(private readonly serviceRequestService: ServiceRequestService) {}

  /** POST /service-requests
  Used by the Community App (resident) to create a new request
  */
  @Post()
  @ApiOperation({
    summary: 'Create a service request',
    description:
      'Creates a resident service request, optionally linking attachments and submitting dynamic field values.',
  })
  @Permissions('service_request.create')
  create(
    @Body() createServiceRequestDto: CreateServiceRequestDto,
    @Req() req: any,
  ) {
    const createdById = req.user.id;

    return this.serviceRequestService.create(
      createdById,
      createServiceRequestDto,
    );
  }

  /** GET /service-requests/my-requests
      Implements the Community App's "My requests" view
  */
  @Get('my-requests')
  @ApiOperation({
    summary: 'List my service requests',
    description:
      'Returns the authenticated user’s service requests ordered by most recent first.',
  })
  @Permissions('service_request.view_own')
  findByUser(@Req() req: any) {
    const createdById = req.user.id;

    return this.serviceRequestService.findByUser(createdById);
  }

  // GET /service-requests (Dashboard view: Fetch all)
  @Get()
  @ApiOperation({
    summary: 'List all service requests (dashboard)',
    description:
      'Returns all service requests for dashboard/staff workflows. Add role-based authorization before enabling in production.',
  })
  findAll() {
    // You should add an Authorization Guard here to ensure the user has
    // the MANAGER, OPERATOR, or SUPER_ADMIN Role before running this.
    return this.serviceRequestService.findAll();
  }

  // GET /service-requests/:id
  // @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  @ApiOperation({
    summary: 'Get a service request by id',
    description:
      'Returns a single service request including service, attachments, and submitted field values.',
  })
  findOne(@Param('id') id: string) {
    return this.serviceRequestService.findOne(id);
  }

  // PATCH /service-requests/:id
  // Used by Dashboard staff to update status, assignee, etc.
  // @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a service request (internal)',
    description:
      'Updates internal processing fields such as status and assignee. Intended for dashboard/staff use.',
  })
  update(
    @Param('id') id: string,
    @Body() updateServiceRequestDto: UpdateServiceRequestInternalDto, // CHANGE DTO HERE
  ) {
    return this.serviceRequestService.update(id, updateServiceRequestDto);
  }
}
