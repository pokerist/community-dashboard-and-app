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
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ViolationsService } from './violations.service';
import { CreateViolationDto, UpdateViolationDto } from './dto/violations.dto';
import { ViolationsQueryDto } from './dto/violations-query.dto';
import {
  CreateViolationActionDto,
  ReviewViolationActionDto,
} from './dto/violation-action.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Request } from 'express';

@ApiBearerAuth()
@ApiTags('Violations')
@Controller('violations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ViolationsController {
  constructor(private readonly violationsService: ViolationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Issue a new violation and generate a fine invoice.',
  })
  @Permissions('violation.issue')
  create(@Body() dto: CreateViolationDto, @Req() req: Request) {
    const issuedById = (req as any).user?.id;
    if (!issuedById) throw new BadRequestException('Invalid auth context');

    if (dto.issuedById && dto.issuedById !== issuedById) {
      throw new BadRequestException('issuedById must match the authenticated user');
    }

    return this.violationsService.create({
      ...dto,
      issuedById,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List all violations.' })
  @Permissions('violation.view_all')
  findAll(@Query() query: ViolationsQueryDto) {
    return this.violationsService.findAll(query);
  }

  @Get('me')
  @Permissions('violation.view_own')
  findMine(@Req() req: Request) {
    return this.violationsService.findMine((req as any).user?.id);
  }

  @Get(':id')
  @Permissions('violation.view_own', 'violation.view_all')
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.violationsService.findOneForActor(id, {
      actorUserId: (req as any).user?.id,
      permissions: (req as any).user?.permissions ?? [],
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update violation status (e.g., Appeal).' })
  @Permissions('violation.update')
  update(
    @Param('id') id: string,
    @Body() updateViolationDto: UpdateViolationDto,
  ) {
    return this.violationsService.update(id, updateViolationDto);
  }

  @Post(':id/actions')
  @ApiOperation({ summary: 'Submit violation action request (appeal or fix proof)' })
  @Permissions('violation.view_own', 'violation.view_all')
  createAction(
    @Param('id') violationId: string,
    @Body() dto: CreateViolationActionDto,
    @Req() req: Request,
  ) {
    return this.violationsService.createActionForActor(violationId, {
      actorUserId: (req as any).user?.id,
      permissions: (req as any).user?.permissions ?? [],
      dto,
    });
  }

  @Get(':id/actions')
  @ApiOperation({ summary: 'List violation action requests for this violation' })
  @Permissions('violation.view_own', 'violation.view_all')
  listActions(@Param('id') violationId: string, @Req() req: Request) {
    return this.violationsService.listActionsForActor(violationId, {
      actorUserId: (req as any).user?.id,
      permissions: (req as any).user?.permissions ?? [],
    });
  }

  @Patch('actions/:actionId/review')
  @ApiOperation({ summary: 'Admin review violation action request' })
  @Permissions('violation.update')
  reviewAction(
    @Param('actionId') actionId: string,
    @Body() dto: ReviewViolationActionDto,
    @Req() req: Request,
  ) {
    return this.violationsService.reviewActionRequest(
      actionId,
      (req as any).user?.id,
      dto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Cancel/Delete a violation and its pending invoice.',
  })
  @Permissions('violation.cancel')
  remove(@Param('id') id: string) {
    return this.violationsService.remove(id);
  }
}
