import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import {
  CreateMarketingProjectDto,
  UpdateMarketingProjectDto,
} from './dto/marketing-project.dto';
import { ListMarketingReferralsDto } from './dto/list-marketing-referrals.dto';
import { UpdateMarketingReferralStatusDto } from './dto/update-marketing-referral-status.dto';
import { MarketingService } from './marketing.service';

@ApiTags('Marketing')
@Controller('marketing')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Get('stats')
  @Permissions('referral.view_all', 'admin.view')
  @ApiOperation({ summary: 'Get marketing overview stats' })
  getStats() {
    return this.marketingService.getStats();
  }

  @Get('projects')
  @Permissions('referral.view_all', 'admin.view')
  @ApiOperation({ summary: 'List marketing projects' })
  listProjects() {
    return this.marketingService.listProjects();
  }

  @Post('projects')
  @Permissions('referral.create', 'admin.update')
  @ApiOperation({ summary: 'Create marketing project' })
  createProject(@Body() dto: CreateMarketingProjectDto) {
    return this.marketingService.createProject(dto);
  }

  @Patch('projects/:id')
  @Permissions('referral.create', 'admin.update')
  @ApiOperation({ summary: 'Update marketing project' })
  updateProject(
    @Param('id') id: string,
    @Body() dto: UpdateMarketingProjectDto,
  ) {
    return this.marketingService.updateProject(id, dto);
  }

  @Get('referrals')
  @Permissions('referral.view_all', 'admin.view')
  @ApiOperation({ summary: 'List referrals for marketing' })
  listReferrals(@Query() query: ListMarketingReferralsDto) {
    return this.marketingService.listReferrals(query);
  }

  @Patch('referrals/:id/status')
  @Permissions('referral.view_all', 'admin.update')
  @ApiOperation({ summary: 'Update referral status' })
  updateReferralStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMarketingReferralStatusDto,
  ) {
    return this.marketingService.updateReferralStatus(id, dto);
  }
}
