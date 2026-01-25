import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ClubhouseService } from './clubhouse.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('clubhouse')
@UseGuards(JwtAuthGuard)
export class ClubhouseController {
  constructor(private readonly clubhouseService: ClubhouseService) {}

  @Post('request-access')
  createAccessRequest(@Body() body: { unitId: string }) {
    // TODO: get userId from auth
    const userId = 'user-id'; // req.user.id
    return this.clubhouseService.createAccessRequest(userId, body.unitId);
  }

  @Post('approve/:id')
  approve(@Param('id') id: string) {
    // TODO: get approvedBy from auth
    const approvedBy = 'admin-id'; // req.user.id
    return this.clubhouseService.approveAccessRequest(id, approvedBy);
  }

  @Post('reject/:id')
  reject(@Param('id') id: string) {
    return this.clubhouseService.rejectAccessRequest(id);
  }

  @Get('pending')
  getPendingRequests() {
    return this.clubhouseService.getPendingRequests();
  }

  @Get('my-access')
  getMyAccess() {
    // TODO: get userId from auth
    const userId = 'user-id'; // req.user.id
    return this.clubhouseService.getUserAccess(userId);
  }
}
