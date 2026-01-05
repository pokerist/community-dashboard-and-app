import { PartialType } from '@nestjs/swagger';
import { CreatePendingRegistrationDto } from './create-pending-registration.dto';

export class UpdatePendingRegistrationDto extends PartialType(
  CreatePendingRegistrationDto,
) {}
