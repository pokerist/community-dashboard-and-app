// src/service-request/service-request.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Headers,
  Req
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ServiceRequestService } from './service-request.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { AuthGuard } from '@nestjs/passport'; // Example, replace with your actual guard
import { User as UserModel } from '@prisma/client';
import { UpdateServiceRequestInternalDto } from './dto/update-service-request-internal.dto';

// Mock decorator for demonstration (replace with your actual one)
// const User = (data?: keyof UserModel) => createParamDecorator((data, ctx) => { /* ... */ });
interface CustomRequest extends Request {
  user: UserModel; // Assume user model is attached by AuthGuard
}

@ApiTags('Service Requests')
@Controller('service-requests')
export class ServiceRequestController {
  constructor(private readonly serviceRequestService: ServiceRequestService) {}

  // POST /service-requests
  // Used by the Community App (resident) to create a new request
  // @UseGuards(AuthGuard('jwt')) // Protects the route
  @Post()
  @ApiOperation({
    summary: 'Create a service request',
    description:
      'Creates a resident service request, optionally linking attachments and submitting dynamic field values.',
  })
  @ApiHeader({
    name: 'x-user-id',
    required: true,
    description:
      'Temporary user identifier header (replace with JWT once authentication is wired).',
  })
  create(
    @Body() createServiceRequestDto: CreateServiceRequestDto,
    @Headers('x-user-id') createdById: string, // <-- TEMPORARY
    @Req() req: CustomRequest, // Use request to get authenticated user
  ) {
    // const createdById = req.user.id; // Get ID from the authenticated user object
    return this.serviceRequestService.create(
      createdById,
      createServiceRequestDto,
    );
  }

  // GET /service-requests/my-requests
  // Implements the Community App's "My requests" view
  // @UseGuards(AuthGuard('jwt'))
  @Get('my-requests')
  @ApiOperation({
    summary: 'List my service requests',
    description:
      'Returns the authenticated user’s service requests ordered by most recent first.',
  })
  @ApiHeader({
    name: 'x-user-id',
    required: true,
    description:
      'Temporary user identifier header (replace with JWT once authentication is wired).',
  })
  findByUser(
    @Headers('x-user-id') createdById: string, // <-- TEMPORARY
    @Req() req: CustomRequest,
  ) {
    // This is the implementation for the "My requests" feature
    return this.serviceRequestService.findByUser(createdById);
  }

  // GET /service-requests (Dashboard view: Fetch all)
  // @UseGuards(AuthGuard('jwt'))
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
