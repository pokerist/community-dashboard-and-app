import { IsBoolean } from 'class-validator';

export class UpdateMeSecurityDto {
  @IsBoolean()
  twoFactorEnabled!: boolean;
}
