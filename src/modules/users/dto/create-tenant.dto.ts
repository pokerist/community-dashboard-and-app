import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTenantDto {
  @IsNotEmpty()
  @IsString()
  userId!: string;
}
