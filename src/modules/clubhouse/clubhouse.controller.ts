import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ClubhouseService } from './clubhouse.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Clubhouse')
@Controller('clubhouse')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ClubhouseController {
  constructor(private readonly clubhouseService: ClubhouseService) {}

  @Post('request-access')
  @ApiOperation({ summary: 'Request clubhouse access for a unit (pending admin approval)' })
  createAccessRequest(@Body() body: { unitId: string }, @Req() req: any) {
    return this.clubhouseService.createAccessRequest(req.user.id, body.unitId);
  }

  @Post('approve/:id')
  @ApiOperation({ summary: 'Admin approves a clubhouse access request' })
  approve(@Param('id') id: string, @Req() req: any) {
    return this.clubhouseService.approveAccessRequest(id, req.user.id);
  }

  @Post('reject/:id')
  @ApiOperation({ summary: 'Admin rejects a clubhouse access request' })
  reject(@Param('id') id: string, @Req() req: any) {
    return this.clubhouseService.rejectAccessRequest(id, req.user.id);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Admin lists pending clubhouse access requests' })
  getPendingRequests(@Req() req: any) {
    return this.clubhouseService.getPendingRequests(req.user.id);
  }

  @Get('my-access')
  @ApiOperation({ summary: 'Get my approved clubhouse access records' })
  getMyAccess(@Req() req: any) {
    return this.clubhouseService.getUserAccess(req.user.id);
  }
}
