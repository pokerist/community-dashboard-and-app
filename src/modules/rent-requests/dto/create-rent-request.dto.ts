import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NationalityType } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateRentRequestDto {
  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiProperty({ example: 'John Tenant' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  tenantName!: string;

  @ApiProperty({ example: 'tenant@example.com' })
  @IsEmail()
  tenantEmail!: string;

  @ApiProperty({ example: '+201100000000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(24)
  tenantPhone!: string;

  @ApiPropertyOptional({ example: '29801...' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  tenantNationalId?: string;

  @ApiPropertyOptional({
    enum: NationalityType,
    default: NationalityType.EGYPTIAN,
  })
  @IsOptional()
  @IsEnum(NationalityType)
  tenantNationality?: NationalityType;

  @ApiPropertyOptional({ description: 'National ID/passport file id' })
  @IsOptional()
  @IsUUID()
  tenantNationalIdFileId?: string;

  @ApiProperty({ description: 'Signed rent contract file id' })
  @IsUUID()
  contractFileId!: string;
}
