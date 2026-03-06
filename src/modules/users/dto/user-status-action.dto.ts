import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SuspendUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class ActivateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
