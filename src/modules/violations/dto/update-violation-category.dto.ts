import { PartialType } from '@nestjs/swagger';
import { CreateViolationCategoryDto } from './create-violation-category.dto';

export class UpdateViolationCategoryDto extends PartialType(CreateViolationCategoryDto) {}
