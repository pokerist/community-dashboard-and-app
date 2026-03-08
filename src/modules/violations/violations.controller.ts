import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
import { CreateViolationDto } from './dto/create-violation.dto';
import { ListAppealRequestsQueryDto } from './dto/list-appeal-requests-query.dto';
import { ReviewAppealDto } from './dto/review-appeal.dto';
import { UpdateViolationDto } from './dto/update-violation.dto';
import { CreateViolationActionDto } from './dto/violation-action.dto';
import { ViolationsQueryDto } from './dto/violations-query.dto';
import { ViolationsService } from './violations.service';

interface AuthUserContext {
  id: string;
}

interface AuthenticatedRequest extends Request {
  user?: AuthUserContext;
}

@ApiBearerAuth()
@ApiTags('Violations')
@Controller('violations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ViolationsController {
  constructor(private readonly violationsService: ViolationsService) {}

  @Get('me')
  @Permissions('violation.view_own')
  listMyViolations(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('Invalid auth context');
    }
    return this.violationsService.listMyViolations(userId);
  }

  @Get()
  @Permissions('violation.view_all')
  listViolations(@Query() query: ViolationsQueryDto) {
    return this.violationsService.listViolations(query);
  }

  @Get('stats')
  @Permissions('violation.view_all')
  getViolationStats() {
    return this.violationsService.getViolationStats();
  }

  @Get('appeals')
  @Permissions('violation.view_all', 'violation.update')
  listAppealRequests(@Query() query: ListAppealRequestsQueryDto) {
    return this.violationsService.listAppealRequests(query);
  }

  @Get(':id')
  @Permissions('violation.view_all', 'violation.view_own')
  getViolationDetail(@Param('id') id: string) {
    return this.violationsService.getViolationDetail(id);
  }

  @Get(':id/actions')
  @Permissions('violation.view_all', 'violation.view_own')
  listViolationActions(@Param('id') id: string) {
    return this.violationsService.listViolationActions(id);
  }

  @Post(':id/actions')
  @Permissions('violation.view_own')
  submitViolationAction(
    @Param('id') id: string,
    @Body() dto: CreateViolationActionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('Invalid auth context');
    }
    return this.violationsService.submitViolationAction(id, dto, userId);
  }

  @Post()
  @Permissions('violation.issue')
  createViolation(@Body() dto: CreateViolationDto, @Req() req: AuthenticatedRequest) {
    const issuedById = req.user?.id;
    if (!issuedById) {
      throw new BadRequestException('Invalid auth context');
    }
    return this.violationsService.createViolation(dto, issuedById);
  }

  @Patch(':id')
  @Permissions('violation.update')
  updateViolation(@Param('id') id: string, @Body() dto: UpdateViolationDto) {
    return this.violationsService.updateViolation(id, dto);
  }

  @Patch(':id/cancel')
  @Permissions('violation.cancel')
  cancelViolation(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const adminId = req.user?.id;
    if (!adminId) {
      throw new BadRequestException('Invalid auth context');
    }
    return this.violationsService.cancelViolation(id, adminId);
  }

  @Patch(':id/pay')
  @Permissions('violation.update')
  markAsPaid(@Param('id') id: string) {
    return this.violationsService.markAsPaid(id);
  }

  @Post('appeals/:id/review')
  @Permissions('violation.update')
  reviewAppeal(
    @Param('id') actionRequestId: string,
    @Body() dto: ReviewAppealDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const reviewerUserId = req.user?.id;
    if (!reviewerUserId) {
      throw new BadRequestException('Invalid auth context');
    }
    return this.violationsService.reviewAppeal(actionRequestId, dto, reviewerUserId);
  }

  @Post('fixes/:id/review')
  @Permissions('violation.update')
  reviewFixSubmission(
    @Param('id') actionRequestId: string,
    @Body() dto: ReviewAppealDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const reviewerUserId = req.user?.id;
    if (!reviewerUserId) {
      throw new BadRequestException('Invalid auth context');
    }
    return this.violationsService.reviewFixSubmission(
      actionRequestId,
      dto,
      reviewerUserId,
    );
  }
}
