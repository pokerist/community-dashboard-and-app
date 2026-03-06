import { IsUUID } from 'class-validator';

export class AssignRequestDto {
  @IsUUID('4', { message: 'Assigned To ID must be a valid UUID.' })
  assignedToId!: string;
}

