import { PartialType } from '@nestjs/mapped-types';
import { CreateDelegateDto } from './create-delegate.dto';

export class UpdateDelegateDto extends PartialType(CreateDelegateDto) {}
