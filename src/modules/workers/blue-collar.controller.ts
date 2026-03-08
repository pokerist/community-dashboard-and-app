import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { BlueCollarService } from './blue-collar.service';
import { AddHolidayDto } from './dto/add-holiday.dto';
import { BlueCollarSettingsDto } from './dto/blue-collar-settings.dto';
import { CommunityIdQueryDto } from './dto/community-id-query.dto';
import { CreateBlueCollarAccessRequestDto } from './dto/create-blue-collar-access-request.dto';
import { ListBlueCollarAccessRequestsDto } from './dto/list-blue-collar-access-requests.dto';
import { ListBlueCollarHolidaysDto } from './dto/list-blue-collar-holidays.dto';
import { ListBlueCollarWorkersDto } from './dto/list-blue-collar-workers.dto';
import { RejectWorkerAccessDto } from './dto/reject-worker-access.dto';
import { ReviewBlueCollarAccessRequestDto } from './dto/review-blue-collar-access-request.dto';
import { UpdateTermsDto } from './dto/update-terms.dto';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

@ApiTags('Blue Collar')
@Controller('blue-collar')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class BlueCollarController {
  constructor(private readonly blueCollarService: BlueCollarService) {}

  @Get('settings')
  @Permissions('blue_collar.view_all')
  @ApiOperation({ summary: 'Get blue collar settings for a community' })
  getSettings(@Query() query: CommunityIdQueryDto) {
    return this.blueCollarService.getSettings(query.communityId);
  }

  @Put('settings')
  @Permissions('blue_collar.settings.update')
  @ApiOperation({ summary: 'Upsert blue collar settings (admin only)' })
  upsertSettings(
    @Query() query: CommunityIdQueryDto,
    @Body() dto: BlueCollarSettingsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.blueCollarService.upsertSettings(query.communityId, dto, req.user.id);
  }

  @Get('holidays')
  @Permissions('blue_collar.view_all')
  @ApiOperation({ summary: 'List blue collar holidays by community and optional year' })
  listHolidays(@Query() query: ListBlueCollarHolidaysDto) {
    return this.blueCollarService.listHolidays(query.communityId, query.year);
  }

  @Post('holidays')
  @Permissions('blue_collar.settings.update')
  @ApiOperation({ summary: 'Add holiday (admin only)' })
  addHoliday(
    @Query() query: CommunityIdQueryDto,
    @Body() dto: AddHolidayDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.blueCollarService.addHoliday(query.communityId, dto, req.user.id);
  }

  @Delete('holidays/:id')
  @Permissions('blue_collar.settings.update')
  @ApiOperation({ summary: 'Remove holiday (admin only)' })
  removeHoliday(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.blueCollarService.removeHoliday(id, req.user.id);
  }

  @Get('terms')
  @Permissions('blue_collar.view_all')
  @ApiOperation({ summary: 'Get terms and conditions for a community' })
  getTerms(@Query() query: CommunityIdQueryDto) {
    return this.blueCollarService.getTermsAndConditions(query.communityId);
  }

  @Put('terms')
  @Permissions('blue_collar.settings.update')
  @ApiOperation({ summary: 'Update terms and conditions (admin only)' })
  updateTerms(
    @Query() query: CommunityIdQueryDto,
    @Body() dto: UpdateTermsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.blueCollarService.updateTermsAndConditions(query.communityId, dto, req.user.id);
  }

  @Get('workers')
  @Permissions('blue_collar.view_all')
  @ApiOperation({ summary: 'List blue collar workers with filters' })
  listWorkers(@Query() query: ListBlueCollarWorkersDto) {
    return this.blueCollarService.listWorkers(query);
  }

  @Get('workers/pending')
  @Permissions('blue_collar.view_all')
  @ApiOperation({ summary: 'List workers pending access approval in a community' })
  listPendingWorkers(@Query() query: CommunityIdQueryDto) {
    return this.blueCollarService.listPendingWorkers(query.communityId);
  }

  @Get('workers/:id')
  @Permissions('blue_collar.view_all')
  @ApiOperation({ summary: 'Get worker detail' })
  getWorkerDetail(@Param('id') id: string) {
    return this.blueCollarService.getWorkerDetail(id);
  }

  @Post('workers/:id/approve')
  @Permissions('blue_collar.request.review')
  @ApiOperation({ summary: 'Approve worker access profile (admin only)' })
  approveWorkerAccess(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.blueCollarService.approveWorkerAccess(id, req.user.id);
  }

  @Post('workers/:id/reject')
  @Permissions('blue_collar.request.review')
  @ApiOperation({ summary: 'Reject worker access profile (admin only)' })
  rejectWorkerAccess(
    @Param('id') id: string,
    @Body() dto: RejectWorkerAccessDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.blueCollarService.rejectWorkerAccess(id, dto, req.user.id);
  }

  @Get('stats')
  @Permissions('blue_collar.view_all')
  @ApiOperation({ summary: 'Get blue collar worker stats by community' })
  getWorkerStats(@Query() query: CommunityIdQueryDto) {
    return this.blueCollarService.getWorkerStats(query.communityId);
  }

  // Legacy request workflow endpoints retained for compatibility.
  @Post('requests')
  @Permissions('blue_collar.request.create')
  @ApiOperation({ summary: 'Submit a blue collar worker access request' })
  createAccessRequest(
    @Body() dto: CreateBlueCollarAccessRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.blueCollarService.createAccessRequest(dto, req.user.id);
  }

  @Get('requests')
  @Permissions('blue_collar.view_all', 'blue_collar.request.create')
  @ApiOperation({ summary: 'List blue collar access requests' })
  listAccessRequests(
    @Query() query: ListBlueCollarAccessRequestsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.blueCollarService.listAccessRequests(query, req.user.id);
  }

  @Put('requests/:id/review')
  @Permissions('blue_collar.request.review')
  @ApiOperation({ summary: 'Approve or reject blue collar access request (admin only)' })
  reviewAccessRequest(
    @Param('id') id: string,
    @Body() dto: ReviewBlueCollarAccessRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.blueCollarService.reviewAccessRequest(id, dto, req.user.id);
  }
}
