import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Priority, ComplaintStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { DashboardPeriod } from './dashboard-stats-response.dto';

export class DashboardDrilldownQueryDto {
  @ApiPropertyOptional({
    enum: DashboardPeriod,
    default: DashboardPeriod.MONTHLY,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(DashboardPeriod)
  period?: DashboardPeriod;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class OpenComplaintDrilldownItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  complaintNumber!: string;

  @ApiProperty()
  category!: string;

  @ApiProperty({ enum: Priority })
  priority!: Priority;

  @ApiProperty({ enum: ComplaintStatus })
  status!: ComplaintStatus;

  @ApiProperty({ nullable: true })
  unitNumber!: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class CurrentVisitorDrilldownItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  visitorName!: string | null;

  @ApiProperty({ nullable: true })
  unitNumber!: string | null;

  @ApiProperty({ nullable: true })
  checkedInAt!: string | null;

  @ApiProperty()
  validTo!: string;
}

export class RevenueDrilldownItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  invoiceNumber!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty({ nullable: true })
  residentName!: string | null;

  @ApiProperty({ nullable: true })
  unitNumber!: string | null;

  @ApiProperty()
  paidDate!: string;
}

