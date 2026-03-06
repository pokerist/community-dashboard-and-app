import { AccessStatus } from '@prisma/client';

export class WorkerAccessDecisionResponseDto {
  accessProfileId!: string;
  status!: AccessStatus;
  notes!: string | null;
}
