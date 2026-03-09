import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AddCommentDto } from './dto/add-comment.dto';
import { AssignComplaintDto } from './dto/assign-complaint.dto';
import { ComplaintsQueryDto } from './dto/complaints-query.dto';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintDto } from './dto/update-complaint.dto';
import { UpdateComplaintStatusDto } from './dto/update-status.dto';
import { ReturnToResidentDto } from './dto/return-to-resident.dto';
import { ComplaintsService } from './complaints.service';

interface AuthUserContext {
  id: string;
}

interface AuthenticatedRequest extends Request {
  user?: AuthUserContext;
}

@ApiBearerAuth()
@ApiTags('Complaints')
@Controller('complaints')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Get('me')
  @Permissions('complaint.view_own')
  listMyComplaints(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('Invalid auth context');
    }
    return this.complaintsService.listMyComplaints(userId);
  }

  @Get()
  @Permissions('complaint.view_all')
  listComplaints(@Query() query: ComplaintsQueryDto) {
    return this.complaintsService.listComplaints(query);
  }

  @Get('stats')
  @Permissions('complaint.view_all')
  getComplaintStats() {
    return this.complaintsService.getComplaintStats();
  }

  @Get(':id')
  @Permissions('complaint.view_all', 'complaint.view_own')
  getComplaintDetail(@Param('id') id: string) {
    return this.complaintsService.getComplaintDetail(id);
  }

  @Get(':id/comments')
  @Permissions('complaint.view_all', 'complaint.view_own')
  listComments(@Param('id') id: string) {
    return this.complaintsService.listComments(id);
  }

  @Post()
  @Permissions('complaint.report', 'complaint.manage')
  createComplaint(@Body() dto: CreateComplaintDto, @Req() req: AuthenticatedRequest) {
    const reporterId = req.user?.id;
    if (!reporterId) {
      throw new BadRequestException('Invalid auth context');
    }

    return this.complaintsService.createComplaint(dto, reporterId);
  }

  @Patch(':id')
  @Permissions('complaint.manage')
  updateComplaint(@Param('id') id: string, @Body() dto: UpdateComplaintDto) {
    return this.complaintsService.updateComplaint(id, dto);
  }

  @Patch(':id/assign')
  @Permissions('complaint.manage')
  assignComplaint(
    @Param('id') id: string,
    @Body() dto: AssignComplaintDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const adminId = req.user?.id;
    if (!adminId) {
      throw new BadRequestException('Invalid auth context');
    }

    return this.complaintsService.assignComplaint(id, dto.assignedToId, adminId);
  }

  @Patch(':id/status')
  @Permissions('complaint.manage')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateComplaintStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const adminId = req.user?.id;
    if (!adminId) {
      throw new BadRequestException('Invalid auth context');
    }
    return this.complaintsService.updateStatus(id, dto.status, dto.resolutionNotes, adminId);
  }

  @Get(':id/history')
  @Permissions('complaint.view_all', 'complaint.view_own')
  getStatusHistory(@Param('id') id: string) {
    return this.complaintsService.getStatusHistory(id);
  }

  @Post(':id/comments')
  @Permissions('complaint.view_all', 'complaint.view_own', 'complaint.manage')
  addComment(
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const authorId = req.user?.id;
    if (!authorId) {
      throw new BadRequestException('Invalid auth context');
    }

    return this.complaintsService.addComment(id, dto, authorId);
  }

  @Patch(':id/return-to-resident')
  @Permissions('complaint.manage')
  returnToResident(
    @Param('id') id: string,
    @Body() dto: ReturnToResidentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const adminId = req.user?.id;
    if (!adminId) {
      throw new BadRequestException('Invalid auth context');
    }

    return this.complaintsService.returnToResident(id, dto.message, adminId);
  }

  @Delete(':id')
  @Permissions('complaint.delete_own')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteComplaint(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('Invalid auth context');
    }
    return this.complaintsService.deleteComplaint(id, userId);
  }

  @Post('check-sla')
  @Permissions('complaint.manage')
  checkSlaBreaches() {
    return this.complaintsService.checkSlaBreaches();
  }
}
