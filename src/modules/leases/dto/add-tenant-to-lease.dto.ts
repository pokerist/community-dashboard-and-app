import { ApiProperty } from '@nestjs/swagger';
import {
  IsDate,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LeaseStatus } from '@prisma/client';

export class AddTenantToLeaseDto {
  @ApiProperty({
    example: 'tenant@example.com',
    description: 'The email of the tenant',
  })
  @IsEmail()
  @IsNotEmpty()
  tenantEmail: string;

  @ApiProperty({
    example: '123456789',
    description: 'The national ID of the tenant',
  })
  @IsString()
  @IsNotEmpty()
  tenantNationalId: string;

  @ApiProperty({ example: 'John Doe', description: 'The name of the tenant' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '+201234567890',
    description: 'The phone number of the tenant',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    example: 'file-uuid-here',
    description: 'The ID of the uploaded national ID photo',
  })
  @IsUUID()
  @IsNotEmpty()
  nationalIdPhotoId: string;
}
