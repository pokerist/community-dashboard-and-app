// src/modules/violations/violations.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ViolationsService } from './violations.service';
import { CreateViolationDto, UpdateViolationDto } from './dto/violations.dto';

@ApiTags('Violations')
@Controller('violations')
export class ViolationsController {
  constructor(private readonly violationsService: ViolationsService) {}

  @Post()
  @ApiOperation({ summary: 'Issue a new violation and generate a fine invoice.' })
  create(@Body() createViolationDto: CreateViolationDto) {
    return this.violationsService.create(createViolationDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all violations.' })
  findAll() {
    return this.violationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.violationsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update violation status (e.g., Appeal).' })
  update(@Param('id') id: string, @Body() updateViolationDto: UpdateViolationDto) {
    return this.violationsService.update(id, updateViolationDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel/Delete a violation and its pending invoice.' })
  remove(@Param('id') id: string) {
    return this.violationsService.remove(id);
  }
}