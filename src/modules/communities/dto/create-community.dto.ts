import { ApiProperty } from '@nestjs/swagger';
import { EntryRole } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCommunityDto {
  @ApiProperty({ example: 'Al Karma Gates' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ required: false, example: 'AKG' })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  code?: string;

  @ApiProperty({ required: false, example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    required: false,
    isArray: true,
    enum: EntryRole,
    example: [EntryRole.RESIDENT_OWNER, EntryRole.VISITOR, EntryRole.STAFF],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(EntryRole, { each: true })
  allowedEntryRoles?: EntryRole[];
}
