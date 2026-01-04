// src/service-field/dto/update-service-field.dto.ts

import { PartialType } from '@nestjs/mapped-types';
import { CreateServiceFieldDto } from './create-service-field.dto';

export class UpdateServiceFieldDto extends PartialType(CreateServiceFieldDto) {}
