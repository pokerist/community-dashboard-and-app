import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
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
    if (process.env.ENABLE_PUBLIC_SIGNUP !== 'true') {
      throw new NotFoundException();
    }
    return this.service.create(dto);
  }
}
