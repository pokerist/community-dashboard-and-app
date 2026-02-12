import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateContractorDto {
  @ApiProperty({ example: 'unit-uuid-here', description: 'Authorization scope' })
  @IsUUID()
  @IsNotEmpty()
  unitId!: string;

  @ApiProperty({ example: 'ACME Interiors' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}

