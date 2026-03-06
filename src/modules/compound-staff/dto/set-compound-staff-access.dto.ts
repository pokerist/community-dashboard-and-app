import { ApiProperty } from '@nestjs/swagger';
import { CompoundStaffPermission } from '@prisma/client';
import { ArrayUnique, IsArray, IsEnum } from 'class-validator';

export class SetCompoundStaffAccessDto {
  @ApiProperty({
    enum: CompoundStaffPermission,
    isArray: true,
    example: [
      CompoundStaffPermission.ENTRY_EXIT,
      CompoundStaffPermission.WORK_ORDERS,
      CompoundStaffPermission.ATTENDANCE,
    ],
  })
  @IsArray()
  @ArrayUnique()
  @IsEnum(CompoundStaffPermission, { each: true })
  permissions!: CompoundStaffPermission[];
}
