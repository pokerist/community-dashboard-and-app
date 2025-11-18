import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

// Inherits all fields from CreateUserDto and makes them optional
export class UpdateUserDto extends PartialType(CreateUserDto) {}