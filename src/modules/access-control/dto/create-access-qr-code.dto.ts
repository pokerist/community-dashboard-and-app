import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QRType, AccessGrantPermission } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateAccessQrCodeDto {
  @ApiProperty({ example: 'unit-uuid-here' })
  @IsUUID()
  @IsNotEmpty()
  unitId!: string;

  @ApiProperty({ enum: QRType, example: QRType.VISITOR })
  @IsEnum(QRType)
  type!: QRType;

  @ApiPropertyOptional({
    example: 'John Visitor',
    description: 'Required for VISITOR',
  })
  @IsString()
  @IsOptional()
  visitorName?: string;

  @ApiPropertyOptional({ example: '2026-02-03T12:00:00.000Z' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  validFrom?: Date;

  @ApiPropertyOptional({ example: '2026-02-03T13:00:00.000Z' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  validTo?: Date;

  @ApiPropertyOptional({
    isArray: true,
    enum: AccessGrantPermission,
    example: [AccessGrantPermission.ENTER],
    description: 'Optional. Defaults per QR type if omitted.',
  })
  @IsArray()
  @IsEnum(AccessGrantPermission, { each: true })
  @IsOptional()
  permissions?: AccessGrantPermission[];

  @ApiPropertyOptional({
    isArray: true,
    example: ['GATE_A', 'GATE_B'],
    description: 'Optional list of gates where QR is valid.',
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  @IsOptional()
  gates?: string[];

  @ApiPropertyOptional({ example: 'Delivery driver - food order' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    enum: ['SINGLE_USE', 'MULTI_USE'],
    default: 'SINGLE_USE',
    description: 'Visitor QR usage mode. MULTI_USE stays active until expiry/revoke.',
  })
  @IsIn(['SINGLE_USE', 'MULTI_USE'])
  @IsOptional()
  usageMode?: 'SINGLE_USE' | 'MULTI_USE';
}

