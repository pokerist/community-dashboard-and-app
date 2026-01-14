import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto';
import { DashboardIncidentsQueryDto } from './dto/dashboard-incidents-query.dto';
import { DashboardComplaintsQueryDto } from './dto/dashboard-complaints-query.dto';
import { DashboardRevenueQueryDto } from './dto/dashboard-revenue-query.dto';
import { DashboardOccupancyQueryDto } from './dto/dashboard-occupancy-query.dto';
import { DashboardDevicesQueryDto } from './dto/dashboard-devices-query.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'Get dashboard summary KPIs' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard summary data',
    type: DashboardSummaryDto,
  })
  getSummary(): Promise<DashboardSummaryDto> {
    return this.dashboardService.getSummary();
  }

  @Get('incidents')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'Get paginated list of incidents for dashboard' })
  @ApiResponse({ status: 200, description: 'Paginated incidents list' })
  getIncidents(@Query() query: DashboardIncidentsQueryDto) {
    return this.dashboardService.getIncidents(query);
  }

  @Get('complaints')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'Get paginated list of complaints for dashboard' })
  @ApiResponse({ status: 200, description: 'Paginated complaints list' })
  getComplaints(@Query() query: DashboardComplaintsQueryDto) {
    return this.dashboardService.getComplaints(query);
  }

  @Get('revenue')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'Get revenue chart data' })
  @ApiResponse({ status: 200, description: 'Revenue chart data' })
  getRevenue(@Query() query: DashboardRevenueQueryDto) {
    return this.dashboardService.getRevenue(query);
  }

  @Get('occupancy')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'Get occupancy chart data' })
  @ApiResponse({ status: 200, description: 'Occupancy chart data' })
  getOccupancy(@Query() query: DashboardOccupancyQueryDto) {
    return this.dashboardService.getOccupancy(query);
  }

  @Get('devices')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'Get smart devices status data' })
  @ApiResponse({ status: 200, description: 'Devices status data' })
  getDevices(@Query() query: DashboardDevicesQueryDto) {
    return this.dashboardService.getDevices(query);
  }
}
