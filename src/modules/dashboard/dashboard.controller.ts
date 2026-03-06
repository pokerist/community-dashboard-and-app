import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto';
import { DashboardIncidentsQueryDto } from './dto/dashboard-incidents-query.dto';
import { DashboardComplaintsQueryDto } from './dto/dashboard-complaints-query.dto';
import { DashboardRevenueQueryDto } from './dto/dashboard-revenue-query.dto';
import { DashboardOccupancyQueryDto } from './dto/dashboard-occupancy-query.dto';
import { DashboardDevicesQueryDto } from './dto/dashboard-devices-query.dto';
import { DashboardPeriodQueryDto } from './dto/dashboard-period-query.dto';
import {
  DashboardActivityItemResponseDto,
  DashboardStatsResponseDto,
} from './dto/dashboard-stats-response.dto';
import {
  CurrentVisitorDrilldownItemDto,
  DashboardDrilldownQueryDto,
  OpenComplaintDrilldownItemDto,
  RevenueDrilldownItemDto,
} from './dto/dashboard-drilldown.dto';
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

  @Get('stats')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'Get dashboard stats with period filter' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard stats',
    type: DashboardStatsResponseDto,
  })
  getStats(@Query() query: DashboardPeriodQueryDto): Promise<DashboardStatsResponseDto> {
    return this.dashboardService.getStats(query);
  }

  @Get('activity')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'Get recent dashboard activity feed' })
  @ApiResponse({
    status: 200,
    description: 'Recent dashboard activity feed',
    type: DashboardActivityItemResponseDto,
    isArray: true,
  })
  getActivity(): Promise<DashboardActivityItemResponseDto[]> {
    return this.dashboardService.getActivity();
  }

  @Get('drilldown/open-complaints')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'Get open complaints drilldown rows' })
  @ApiResponse({
    status: 200,
    description: 'Open complaints drilldown rows',
    type: OpenComplaintDrilldownItemDto,
    isArray: true,
  })
  getOpenComplaintsDrilldown(
    @Query() query: DashboardDrilldownQueryDto,
  ): Promise<OpenComplaintDrilldownItemDto[]> {
    return this.dashboardService.getOpenComplaintsDrilldown(query);
  }

  @Get('drilldown/current-visitors')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'Get current visitors drilldown rows' })
  @ApiResponse({
    status: 200,
    description: 'Current visitors drilldown rows',
    type: CurrentVisitorDrilldownItemDto,
    isArray: true,
  })
  getCurrentVisitorsDrilldown(
    @Query() query: DashboardDrilldownQueryDto,
  ): Promise<CurrentVisitorDrilldownItemDto[]> {
    return this.dashboardService.getCurrentVisitorsDrilldown(query);
  }

  @Get('drilldown/revenue')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'Get paid invoices drilldown rows for selected period' })
  @ApiResponse({
    status: 200,
    description: 'Revenue drilldown rows',
    type: RevenueDrilldownItemDto,
    isArray: true,
  })
  getRevenueDrilldown(
    @Query() query: DashboardDrilldownQueryDto,
  ): Promise<RevenueDrilldownItemDto[]> {
    return this.dashboardService.getRevenueDrilldown(query);
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
