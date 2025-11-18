import { PartialType } from '@nestjs/swagger';
import { CreateResidentDto } from './create-resident.dto';

// Inherits all fields from CreateUserDto and makes them optional
export class UpdateResidentDto extends PartialType(CreateResidentDto) {}