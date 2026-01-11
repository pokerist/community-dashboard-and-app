import { ApiProperty } from '@nestjs/swagger';

export class DashboardSummaryDto {
  @ApiProperty({ description: 'Number of active incidents' })
  activeIncidents: number;

  @ApiProperty({ description: 'Number of incidents resolved today' })
  resolvedToday: number;

  @ApiProperty({ description: 'Average response time in seconds' })
  avgResponseTime: number;

  @ApiProperty({ description: 'Number of open complaints' })
  openComplaints: number;

  @ApiProperty({ description: 'Number of pending registrations' })
  pendingRegistrations: number;

  @ApiProperty({ description: 'Overall occupancy rate percentage' })
  occupancyRate: number;

  @ApiProperty({ description: 'Revenue for current month' })
  revenueThisMonth: number;

  @ApiProperty({ description: 'Revenue for current year' })
  revenueThisYear: number;

  @ApiProperty({ description: 'Smart devices status counts' })
  smartDevices: {
    online: number;
    offline: number;
    error: number;
  };

  @ApiProperty({ description: 'CCTV cameras status counts' })
  cctvCameras: {
    online: number;
    offline: number;
    error: number;
  };
}
