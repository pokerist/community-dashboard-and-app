import {
  Controller,
  Get,
  Post,
  Patch,
  Query,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

// ⭕ NOTE: Delivery for EMAIL is async and best-effort. SMS/PUSH/retries intentionally deferred.

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // Sending notifications to users (ALL/SPECIFIC_USERS/SPECIFIC_UNITS/SPECIFIC_BLOCKS)
  @Post()
  @Permissions('notification.create')
  @ApiOperation({ summary: 'Send a notification' })
  @ApiResponse({ status: 201, description: 'Notification sent successfully' })
  async sendNotification(@Body() dto: SendNotificationDto, @Request() req) {
    const notificationId = await this.notificationsService.sendNotification(
      dto,
      req.user.id,
    );
    return { notificationId };
  }

  // User's notifications
  @Get('me')
  @Permissions('notification.view_own')
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
  })
  async getUserNotifications(
    @Request() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    return this.notificationsService.getUserNotifications(
      req.user.id,
      pageNum,
      limitNum,
    );
  }

  // Mark notification as read
  @Patch(':id/read')
  @Permissions('notification.view_own')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({
    status: 404,
    description: 'Notification not found or not accessible',
  })
  async markAsRead(@Param('id') notificationId: string, @Request() req) {
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

  // Admin endpoints
  @Get('admin/all')
  @Permissions('notification.view_all')
  @ApiOperation({ summary: 'Get all notifications (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'All notifications retrieved successfully',
  })
  async getAllNotifications(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    // This would need to be implemented in the service for admin access
    // For now, return a placeholder
    return {
      data: [],
      meta: {
        total: 0,
        page: pageNum,
        limit: limitNum,
        totalPages: 0,
      },
    };
  }

  @Post('admin/resend/:id')
  @Permissions('notification.manage')
  @ApiOperation({ summary: 'Resend failed notification (Admin)' })
  @ApiResponse({ status: 200, description: 'Notification resent successfully' })
  async resendNotification(@Param('id') notificationId: string) {
    // TODO: Implement resend logic
    return { success: true, notificationId };
  }
}
