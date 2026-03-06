import { PartialType } from '@nestjs/swagger';
import { CreateCommercialBranchDto } from './create-commercial-branch.dto';

export class UpdateCommercialBranchDto extends PartialType(CreateCommercialBranchDto) {}
