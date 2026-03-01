import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ViolationActionStatus, ViolationActionType } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateViolationActionDto {
  @ApiProperty({ enum: ViolationActionType, enumName: 'ViolationActionType' })
  @IsEnum(ViolationActionType)
  type!: ViolationActionType;

  @ApiPropertyOptional({ example: 'I fixed the issue and attached proof.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsUUID('4', { each: true })
  attachmentIds?: string[];
}

export class ReviewViolationActionDto {
  @ApiProperty({ enum: [ViolationActionStatus.APPROVED, ViolationActionStatus.REJECTED] })
  @IsEnum(ViolationActionStatus)
  status!: ViolationActionStatus;

  @ApiPropertyOptional({ example: 'Please upload a clearer proof image.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
