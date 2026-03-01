import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ResolveFireEvacuationDto } from './dto/resolve-fire-evacuation.dto';
import { TriggerFireEvacuationDto } from './dto/trigger-fire-evacuation.dto';
import { FireEvacuationService } from './fire-evacuation.service';

@ApiTags('Fire Evacuation')
@Controller('fire-evacuation')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class FireEvacuationController {
  constructor(private readonly fireEvacuationService: FireEvacuationService) {}

  @Get('admin/status')
  @Permissions('notification.manage')
  @ApiOperation({ summary: 'Get active fire evacuation status for admin dashboard' })
  getAdminStatus() {
    return this.fireEvacuationService.getAdminStatus();
  }

  @Post('admin/trigger')
  @Permissions('notification.manage')
  @ApiOperation({ summary: 'Trigger fire evacuation alert for resident users' })
  trigger(@Body() dto: TriggerFireEvacuationDto, @Request() req: any) {
    return this.fireEvacuationService.trigger(dto, req.user?.id);
  }

  @Post('admin/resolve')
  @Permissions('notification.manage')
  @ApiOperation({ summary: 'Resolve active fire evacuation alert' })
  resolve(@Body() dto: ResolveFireEvacuationDto, @Request() req: any) {
    return this.fireEvacuationService.resolve(dto, req.user?.id);
  }

  @Get('me')
  @Permissions('notification.view_own')
  @ApiOperation({ summary: 'Get current fire evacuation status for logged-in resident' })
  getMyStatus(@Request() req: any) {
    return this.fireEvacuationService.getMyStatus(req.user.id);
  }

  @Post('me/ack')
  @Permissions('notification.view_own')
  @ApiOperation({ summary: 'Acknowledge fire evacuation confirmation as safe' })
  acknowledge(@Request() req: any) {
    return this.fireEvacuationService.acknowledge(req.user.id);
  }
}
