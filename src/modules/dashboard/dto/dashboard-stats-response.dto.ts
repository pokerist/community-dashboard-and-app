import { ApiProperty } from '@nestjs/swagger';

export enum DashboardPeriod {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMI_ANNUAL = 'SEMI_ANNUAL',
  ANNUAL = 'ANNUAL',
}

export enum DashboardActivityType {
  COMPLAINT = 'COMPLAINT',
  SERVICE_REQUEST = 'SERVICE_REQUEST',
  VIOLATION = 'VIOLATION',
  INVOICE = 'INVOICE',
  REGISTRATION = 'REGISTRATION',
}

export class DashboardTicketsByStatusDto {
  @ApiProperty()
  NEW!: number;

  @ApiProperty()
  IN_PROGRESS!: number;

  @ApiProperty()
  RESOLVED!: number;

  @ApiProperty()
  CLOSED!: number;
}

export class DashboardPlatformBreakdownDto {
  @ApiProperty()
  android!: number;

  @ApiProperty()
  ios!: number;
}

export class DashboardKpisDto {
  @ApiProperty()
  totalRegisteredDevices!: number;

  @ApiProperty({ type: DashboardPlatformBreakdownDto })
  totalRegisteredDevicesByPlatform!: DashboardPlatformBreakdownDto;

  @ApiProperty()
  activeMobileUsers!: number;

  @ApiProperty({ type: DashboardPlatformBreakdownDto })
  activeMobileUsersByPlatform!: DashboardPlatformBreakdownDto;

  @ApiProperty()
  totalComplaints!: number;

  @ApiProperty()
  openComplaints!: number;

  @ApiProperty()
  closedComplaints!: number;

  @ApiProperty({ type: DashboardTicketsByStatusDto })
  ticketsByStatus!: DashboardTicketsByStatusDto;

  @ApiProperty()
  revenueCurrentMonth!: number;

  @ApiProperty()
  occupancyRate!: number;

  @ApiProperty()
  currentVisitors!: number;

  @ApiProperty()
  blueCollarWorkers!: number;

  @ApiProperty()
  totalCars!: number;
}

export class DashboardStatsResponseDto {
  @ApiProperty({ enum: DashboardPeriod })
  period!: DashboardPeriod;

  @ApiProperty()
  periodLabel!: string;

  @ApiProperty({ type: DashboardKpisDto })
  kpis!: DashboardKpisDto;

  @ApiProperty()
  generatedAt!: string;
}

export class DashboardActivityItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: DashboardActivityType })
  type!: DashboardActivityType;

  @ApiProperty()
  description!: string;

  @ApiProperty({ nullable: true })
  actorName!: string | null;

  @ApiProperty({ nullable: true })
  unitNumber!: string | null;

  @ApiProperty()
  timestamp!: string;
}

