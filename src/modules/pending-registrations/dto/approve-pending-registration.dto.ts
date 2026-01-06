import { IsNotEmpty, IsString, IsEnum } from 'class-validator';

export enum RegistrationApprovalRole {
  OWNER = 'OWNER',
  TENANT = 'TENANT',
  FAMILY = 'FAMILY',
}

export class ApprovePendingRegistrationDto {
  @IsNotEmpty()
  @IsString()
  userId: string; // will be created User ID after approval

  @IsNotEmpty()
  @IsString()
  unitId: string; // admin assigns unit

  @IsNotEmpty()
  @IsEnum(RegistrationApprovalRole)
  role: RegistrationApprovalRole;

  @IsNotEmpty()
  isPrimary: boolean; // admin decides if this is primary resident
}
