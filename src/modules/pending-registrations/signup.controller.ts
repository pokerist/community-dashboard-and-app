import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PendingRegistrationsService } from './pending-registrations.service';
import { CreatePendingRegistrationDto } from './dto/create-pending-registration.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Signup')
@Controller('signup')
export class SignupController {
  constructor(private readonly service: PendingRegistrationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createPending(@Body() dto: CreatePendingRegistrationDto) {
    return this.service.create(dto);
  }
}