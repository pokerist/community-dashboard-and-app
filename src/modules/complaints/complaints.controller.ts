import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto, UpdateComplaintDto } from './dto/complaints.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateComplaintStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiBearerAuth()
@ApiTags('Complaints')
@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  // ---------------------------
  // RESIDENT: CREATE
  // ---------------------------
  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('complaint.report')
  create(@Body() dto: CreateComplaintDto) {
    return this.complaintsService.create(dto);
  }

  // ---------------------------
  // STAFF: VIEW ALL
  // ---------------------------
  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('complaint.view_all')
  findAll() {
    return this.complaintsService.findAll();
  }

  // ---------------------------
  // RESIDENT OR STAFF: VIEW SPECIFIC
  // ---------------------------
  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('complaint.view_own', 'complaint.view_all')
  findOne(@Param('id') id: string) {
    return this.complaintsService.findOne(id);
  }

  // ---------------------------
  // STAFF: UPDATE COMPLAINT DETAILS
  // (status/assignedTo/notes)
  // ---------------------------
  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('complaint.manage')
  update(@Param('id') id: string, @Body() dto: UpdateComplaintDto) {
    return this.complaintsService.update(id, dto);
  }

  // ---------------------------
  // STAFF: UPDATE STATUS ONLY
  // ---------------------------
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
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
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('complaint.delete_own', 'complaint.delete_all')
  remove(@Param('id') id: string) {
    return this.complaintsService.remove(id);
  }
}

