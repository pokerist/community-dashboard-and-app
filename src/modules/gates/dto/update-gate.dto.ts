import { PartialType } from '@nestjs/swagger';
import { CreateGateDto } from './create-gate.dto';

export class UpdateGateDto extends PartialType(CreateGateDto) {}

