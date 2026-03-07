import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ListDeviceTokensDto } from './dto/list-device-tokens.dto';
import { GetNotificationDetailDto } from './dto/get-notification-detail.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import {
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
} from './dto/notification-template.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { ScheduleNotificationDto } from './dto/schedule-notification.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationsService } from './notifications.service';

type AuthRequest = {
  user: {
    id: string;
  };
};

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('stats')
  @Permissions('notification.view_all')
  @ApiOperation({ summary: 'Get notification stats' })
  getNotificationStats() {
    return this.notificationsService.getNotificationStats();
  }

  @Get()
  @Permissions('notification.view_all')
  @ApiOperation({ summary: 'List notifications (admin)' })
  listNotifications(@Query() query: ListNotificationsDto) {
    return this.notificationsService.listNotifications(query);
  }

  @Get('templates')
  @Permissions('notification.view_all')
  @ApiOperation({ summary: 'List notification templates' })
  listTemplates() {
    return this.notificationsService.listTemplates();
  }

  @Post('templates')
  @Permissions('notification.manage')
  @ApiOperation({ summary: 'Create notification template' })
  createTemplate(@Body() dto: CreateNotificationTemplateDto) {
    return this.notificationsService.createTemplate(dto);
  }

  @Patch('templates/:id')
  @Permissions('notification.manage')
  @ApiOperation({ summary: 'Update notification template' })
  updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateNotificationTemplateDto,
  ) {
    return this.notificationsService.updateTemplate(id, dto);
  }

  @Patch('templates/:id/toggle')
  @Permissions('notification.manage')
  @ApiOperation({ summary: 'Toggle notification template active state' })
  toggleTemplate(@Param('id') id: string) {
    return this.notificationsService.toggleTemplate(id);
  }

  @Post('send')
  @Permissions('notification.create')
  @ApiOperation({ summary: 'Send notification now' })
  @ApiResponse({ status: 201, description: 'Notification sent successfully' })
  async sendNow(@Body() dto: SendNotificationDto, @Request() req: AuthRequest) {
    const notificationId = await this.notificationsService.sendNotification(
      dto,
      req.user.id,
    );
    return { notificationId };
  }

  @Post()
  @Permissions('notification.create')
  @ApiOperation({ summary: 'Send notification now (legacy route)' })
  async sendNotification(@Body() dto: SendNotificationDto, @Request() req: AuthRequest) {
    const notificationId = await this.notificationsService.sendNotification(
      dto,
      req.user.id,
    );
    return { notificationId };
  }

  @Post('schedule')
  @Permissions('notification.create')
  @ApiOperation({ summary: 'Schedule notification' })
  async schedule(
    @Body() dto: ScheduleNotificationDto,
    @Request() req: AuthRequest,
  ) {
    const notificationId = await this.notificationsService.scheduleNotification(
      dto,
      req.user.id,
    );
    return { notificationId };
  }

  @Patch(':id/cancel')
  @Permissions('notification.manage')
  @ApiOperation({ summary: 'Cancel scheduled notification' })
  cancelScheduled(@Param('id') id: string) {
    return this.notificationsService.cancelScheduled(id);
  }

  @Post(':id/resend-failed')
  @Permissions('notification.manage')
  @ApiOperation({ summary: 'Resend failed notification logs' })
  resendFailed(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.notificationsService.resendFailedNotification(id, req.user.id);
  }

  @Get('me')
  @Permissions('notification.view_own')
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
  })
  getUserNotifications(
    @Request() req: AuthRequest,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.notificationsService.getUserNotifications(
      req.user.id,
      this.parsePositiveInt(page, 1),
      this.parsePositiveInt(limit, 20),
    );
  }

  @Get('me/changes')
  @Permissions('notification.view_own')
  @ApiOperation({ summary: 'Get incremental notification changes for current user' })
  @ApiResponse({
    status: 200,
    description: 'Incremental notification changes retrieved successfully',
  })
  getUserNotificationChanges(
    @Request() req: AuthRequest,
    @Query('after') after?: string,
    @Query('limit') limit: string = '50',
  ) {
    return this.notificationsService.getUserNotificationChanges(
      req.user.id,
      after,
      this.parsePositiveInt(limit, 50),
    );
  }

  @Patch(':id/read')
  @Permissions('notification.view_own')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({
    status: 404,
    description: 'Notification not found or not accessible',
  })
  async markAsRead(@Param('id') notificationId: string, @Request() req: AuthRequest) {
    const success = await this.notificationsService.markAsRead(
      notificationId,
      req.user.id,
    );

    if (!success) {
      return {
        success: false,
        message: 'Notification not found or not accessible',
      };
    }

    return { success: true };
  }

  @Get('admin/all')
  @Permissions('notification.view_all')
  @ApiOperation({ summary: 'Get all notifications (legacy admin endpoint)' })
  getAllNotifications(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.notificationsService.getAllNotifications(
      this.parsePositiveInt(page, 1),
      this.parsePositiveInt(limit, 20),
    );
  }

  @Post('admin/resend/:id')
  @Permissions('notification.manage')
  @ApiOperation({ summary: 'Resend failed notification (legacy admin endpoint)' })
  resendNotification(
    @Param('id') notificationId: string,
    @Request() req: AuthRequest,
  ) {
    return this.notificationsService.resendFailedNotification(
      notificationId,
      req.user.id,
    );
  }

  @Post('device-tokens')
  @Permissions('notification.view_own')
  @ApiOperation({ summary: 'Register or refresh a push device token' })
  registerDeviceToken(@Body() dto: RegisterDeviceTokenDto, @Request() req: AuthRequest) {
    return this.notificationsService.registerDeviceToken(req.user.id, dto);
  }

  @Delete('device-tokens/:id')
  @Permissions('notification.view_own', 'notification.manage')
  @ApiOperation({ summary: 'Revoke a push device token (own token or admin)' })
  revokeDeviceToken(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.notificationsService.revokeDeviceToken(id, req.user.id);
  }

  @Get('device-tokens')
  @Permissions('notification.view_all')
  @ApiOperation({ summary: 'List device tokens (admin/debug)' })
  listDeviceTokens(@Query() query: ListDeviceTokensDto) {
    return this.notificationsService.listDeviceTokens(query);
  }

  @Get('admin/providers/status')
  @Permissions('notification.manage')
  @ApiOperation({ summary: 'Notification provider readiness (admin/debug)' })
  getProviderStatus() {
    return this.notificationsService.getProviderStatus();
  }

  @Get(':id')
  @Permissions('notification.view_all')
  @ApiOperation({ summary: 'Get notification details and logs' })
  getNotificationDetail(
    @Param('id') id: string,
    @Query() query: GetNotificationDetailDto,
  ) {
    return this.notificationsService.getNotificationDetail(id, query);
  }

  private parsePositiveInt(value: string, fallback: number): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }
}
