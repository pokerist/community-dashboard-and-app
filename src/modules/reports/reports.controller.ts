import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ReportsService } from './reports.service';
import {
  CreateReportScheduleDto,
  GenerateReportDto,
  ListReportsHistoryDto,
  ListReportSchedulesDto,
  ToggleReportScheduleDto,
} from './dto/reports.dto';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  private actorId(req: any): string | null {
    return req?.user?.id ?? null;
  }

  @Post('generate')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'Generate report and store export snapshot' })
  generate(@Body() dto: GenerateReportDto, @Req() req: any) {
    return this.reportsService.generateReport(dto, this.actorId(req));
  }

  @Get('history')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'List generated reports history' })
  history(@Query() query: ListReportsHistoryDto) {
    return this.reportsService.getHistory(query);
  }

  @Get(':id/download')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'Download generated report file' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const file = await this.reportsService.getReportForDownload(id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.content);
  }

  @Post('schedule')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'Create report schedule definition (demo persistence)' })
  createSchedule(@Body() dto: CreateReportScheduleDto, @Req() req: any) {
    return this.reportsService.createSchedule(dto, this.actorId(req));
  }

  @Get('schedules/list')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'List report schedule definitions' })
  listSchedules(@Query() query: ListReportSchedulesDto) {
    return this.reportsService.listSchedules(query);
  }

  @Patch('schedules/:id')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'Enable/disable report schedule' })
  toggleSchedule(
    @Param('id') id: string,
    @Body() dto: ToggleReportScheduleDto,
  ) {
    return this.reportsService.toggleSchedule(id, dto);
  }

  @Post('schedules/:id/run-now')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'Run a report schedule immediately' })
  runScheduleNow(@Param('id') id: string) {
    return this.reportsService.runScheduleNow(id);
  }

  @Post('schedules/run-due')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'Process due report schedules now (admin/debug)' })
  runDueSchedulesNow() {
    return this.reportsService.processDueSchedules();
  }
}
