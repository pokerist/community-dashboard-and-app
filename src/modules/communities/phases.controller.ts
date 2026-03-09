import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { ReorderPhasesDto } from './dto/reorder-phases.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';
import { PhasesService } from './phases.service';

@ApiTags('communities')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class PhasesController {
  constructor(private readonly phasesService: PhasesService) {}

  @Get('communities/:communityId/phases')
  @Permissions('unit.view_all', 'admin.view')
  listPhases(@Param('communityId') communityId: string) {
    return this.phasesService.listPhases(communityId);
  }

  @Post('communities/:communityId/phases')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('unit.create', 'unit.update', 'admin.update')
  createPhase(
    @Param('communityId') communityId: string,
    @Body() dto: CreatePhaseDto,
  ) {
    return this.phasesService.createPhase(communityId, dto);
  }

  @Patch('communities/:communityId/phases/reorder')
  @Permissions('unit.update', 'admin.update')
  reorderPhases(
    @Param('communityId') communityId: string,
    @Body() dto: ReorderPhasesDto,
  ) {
    return this.phasesService.reorderPhases(communityId, dto);
  }

  @Patch('phases/:id')
  @Permissions('unit.update', 'admin.update')
  updatePhase(@Param('id') id: string, @Body() dto: UpdatePhaseDto) {
    return this.phasesService.updatePhase(id, dto);
  }

  @Delete('phases/:id')
  @HttpCode(HttpStatus.OK)
  @Permissions('unit.delete', 'admin.update')
  deletePhase(@Param('id') id: string) {
    return this.phasesService.deletePhase(id);
  }
}
