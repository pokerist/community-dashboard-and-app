import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto, UpdateComplaintDto } from './dto/complaints.dto';
import { ComplaintsQueryDto } from './dto/complaints-query.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateComplaintStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { Request } from 'express';

@ApiBearerAuth()
@ApiTags('Complaints')
@Controller('complaints')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  // ---------------------------
  // RESIDENT: CREATE
  // ---------------------------
  @Post()
  @Permissions('complaint.report')
  create(@Body() dto: CreateComplaintDto, @Req() req: Request) {
    const reporterId = (req as any).user?.id;
    if (!reporterId) throw new BadRequestException('Invalid auth context');

    if (dto.reporterId && dto.reporterId !== reporterId) {
      throw new BadRequestException('reporterId must match the authenticated user');
    }

    return this.complaintsService.create({
      ...dto,
      reporterId,
    });
  }

  // ---------------------------
  // STAFF: VIEW ALL
  // ---------------------------
  @Get()
  @Permissions('complaint.view_all')
  findAll(@Query() query: ComplaintsQueryDto) {
    return this.complaintsService.findAll(query);
  }

  // ---------------------------
  // RESIDENT OR STAFF: VIEW SPECIFIC
  // ---------------------------
  @Get(':id')
  @Permissions('complaint.view_own', 'complaint.view_all')
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.complaintsService.findOneForActor(id, {
      actorUserId: (req as any).user?.id,
      permissions: (req as any).user?.permissions ?? [],
    });
  }

  // ---------------------------
  // STAFF: UPDATE COMPLAINT DETAILS
  // (status/assignedTo/notes)
  // ---------------------------
  @Patch(':id')
  @Permissions('complaint.manage')
  update(@Param('id') id: string, @Body() dto: UpdateComplaintDto) {
    return this.complaintsService.update(id, dto);
  }

  // ---------------------------
  // STAFF: UPDATE STATUS ONLY
  // ---------------------------
  @Patch(':id/status')
  @Permissions('complaint.manage')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateComplaintStatusDto) {
    return this.complaintsService.updateStatus(
      id,
      dto.status,
      dto.resolutionNotes,
    );
  }

  // ---------------------------
  // RESIDENT: DELETE OWN
  // ADMIN: DELETE ANY
  // ---------------------------
  @Delete(':id')
  @Permissions('complaint.delete_own', 'complaint.delete_all')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.complaintsService.removeForActor(id, {
      actorUserId: (req as any).user?.id,
      permissions: (req as any).user?.permissions ?? [],
    });
  }
}
