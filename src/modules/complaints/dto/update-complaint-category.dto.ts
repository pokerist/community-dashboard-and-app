import { PartialType } from '@nestjs/swagger';
import { CreateComplaintCategoryDto } from './create-complaint-category.dto';

export class UpdateComplaintCategoryDto extends PartialType(CreateComplaintCategoryDto) {}
