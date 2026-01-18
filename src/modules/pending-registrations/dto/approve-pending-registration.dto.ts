import { IsNotEmpty, IsString, IsEnum, IsBoolean } from 'class-validator';

export enum RegistrationApprovalRole {
  OWNER = 'OWNER',
  TENANT = 'TENANT',
  FAMILY = 'FAMILY',
}

export class ApprovePendingRegistrationDto {
  @IsNotEmpty()
  @IsString()
  unitId: string; // admin assigns unit

  @IsNotEmpty()
  @IsEnum(RegistrationApprovalRole)
  role: RegistrationApprovalRole;

  @IsNotEmpty()
  @IsBoolean()
  isPrimary: boolean; // admin decides if this is primary resident
}
