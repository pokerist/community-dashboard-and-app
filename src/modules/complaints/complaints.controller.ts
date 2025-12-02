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

@ApiTags('Complaints')
@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Post()
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Complaint successfully reported.' })
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
  update(
    @Param('id') id: string,
    @Body() updateComplaintDto: UpdateComplaintDto,
  ) {
    return this.complaintsService.update(id, updateComplaintDto);
  }

  // Optional: Dedicated route for simple status update
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: ComplaintStatus,
    @Body('resolutionNotes') notes: string,
  ) {
    return this.complaintsService.updateStatus(id, status, notes);
  }

  @Delete(':id')
  @ApiResponse({ status: HttpStatus.OK, description: 'Complaint successfully deleted if not resolved/closed.' })
  remove(@Param('id') id: string) {
    return this.complaintsService.remove(id);
  }
}