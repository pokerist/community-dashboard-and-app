import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpStatus,
} from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto, UpdateComplaintDto } from './dto/complaints.dto';
import { ApiTags, ApiResponse } from '@nestjs/swagger';
import { ComplaintStatus } from '@prisma/client';
import { UpdateComplaintStatusDto } from './dto/update-status.dto';

@ApiTags('Complaints')
@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Post()
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Complaint successfully reported.',
  })
  create(@Body() createComplaintDto: CreateComplaintDto) {
    return this.complaintsService.create(createComplaintDto);
  }

  @Get()
  findAll() {
    return this.complaintsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.complaintsService.findOne(id);
  }

  @Patch(':id')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Complaint updated. Handles status/assignedTo/notes.',
  })
  update(
    @Param('id') id: string,
    @Body() updateComplaintDto: UpdateComplaintDto,
  ) {
    return this.complaintsService.update(id, updateComplaintDto);
  }

  @Patch(':id/status')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Quick status change. Requires notes for resolve/close.',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateComplaintStatusDto,
  ) {
    return this.complaintsService.updateStatus(
      id,
      dto.status,
      dto.resolutionNotes,
    );
  }

  @Delete(':id')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Complaint deleted (only allowed for NEW or IN_PROGRESS).',
  })
  remove(@Param('id') id: string) {
    return this.complaintsService.remove(id);
  }
}
