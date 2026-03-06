import { ApiProperty } from '@nestjs/swagger';
import { EntryRole } from '@prisma/client';
import { ArrayMinSize, ArrayUnique, IsArray, IsEnum } from 'class-validator';

export class UpdateEntryRolesDto {
  @ApiProperty({
    isArray: true,
    enum: EntryRole,
    example: [EntryRole.RESIDENT_OWNER, EntryRole.VISITOR, EntryRole.STAFF],
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1)
  @IsEnum(EntryRole, { each: true })
  roles!: EntryRole[];
}

