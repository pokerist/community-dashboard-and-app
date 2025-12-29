// src/modules/violations/violations.controller.ts
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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ViolationsService } from './violations.service';
import { CreateViolationDto, UpdateViolationDto } from './dto/violations.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiBearerAuth()
@ApiTags('Violations')
@Controller('violations')
export class ViolationsController {
  constructor(private readonly violationsService: ViolationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Issue a new violation and generate a fine invoice.',
  })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('violation.issue')
  create(@Body() createViolationDto: CreateViolationDto) {
    return this.violationsService.create(createViolationDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all violations.' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('violation.view_all')
  findAll() {
    return this.violationsService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('violation.view_own', 'violation.view_all')
  findOne(@Param('id') id: string) {
    return this.violationsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update violation status (e.g., Appeal).' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('violation.update')
  update(
    @Param('id') id: string,
    @Body() updateViolationDto: UpdateViolationDto,
  ) {
    return this.violationsService.update(id, updateViolationDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Cancel/Delete a violation and its pending invoice.',
  })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('violation.cancel')
  remove(@Param('id') id: string) {
    return this.violationsService.remove(id);
  }
}
