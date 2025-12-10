// src/service-request/service-request.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
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

@Controller('service-requests')
export class ServiceRequestController {
  constructor(private readonly serviceRequestService: ServiceRequestService) {}

  // POST /service-requests
  // Used by the Community App (resident) to create a new request
  // @UseGuards(AuthGuard('jwt')) // Protects the route
  @Post()
  create(
    @Body() createServiceRequestDto: CreateServiceRequestDto,
    @Req() req: CustomRequest, // Use request to get authenticated user
  ) {
    const createdById = req.user.id; // Get ID from the authenticated user object
    return this.serviceRequestService.create(
      createdById,
      createServiceRequestDto,
    );
  }

  // GET /service-requests/my-requests
  // Implements the Community App's "My requests" view
  @UseGuards(AuthGuard('jwt'))
  @Get('my-requests')
  findByUser(@Req() req: CustomRequest) {
    // This is the implementation for the "My requests" feature
    return this.serviceRequestService.findByUser(req.user.id);
  }

  // GET /service-requests (Dashboard view: Fetch all)
  @UseGuards(AuthGuard('jwt'))
  @Get()
  findAll() {
    // You should add an Authorization Guard here to ensure the user has
    // the MANAGER, OPERATOR, or SUPER_ADMIN Role before running this.
    return this.serviceRequestService.findAll();
  }

  // GET /service-requests/:id
  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.serviceRequestService.findOne(id);
  }

  // PATCH /service-requests/:id
  // Used by Dashboard staff to update status, assignee, etc.
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateServiceRequestDto: UpdateServiceRequestInternalDto, // CHANGE DTO HERE
  ) {
    return this.serviceRequestService.update(id, updateServiceRequestDto);
  }
}
