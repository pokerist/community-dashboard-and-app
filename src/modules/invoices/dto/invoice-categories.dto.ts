import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { InvoiceType } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class ListInvoiceCategoriesDto {
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean;
}

export class CreateInvoiceCategoryDto {
  @ApiProperty({ example: 'Community Fees' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiPropertyOptional({ enum: InvoiceType, example: InvoiceType.SERVICE_FEE })
  @IsOptional()
  @IsEnum(InvoiceType)
  mappedType?: InvoiceType;

  @ApiPropertyOptional({
    example: 'Recurring charges related to the community.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '#3b82f6' })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;
}

export class UpdateInvoiceCategoryDto extends PartialType(
  CreateInvoiceCategoryDto,
) {}

export class ReorderInvoiceCategoriesDto {
  @ApiProperty({
    type: [String],
    example: [
      '8d93f0fd-e400-4a13-b478-e4f9e70a2662',
      '474438a2-43e0-4499-b6f8-58a6b0dd785f',
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  orderedIds!: string[];
}
