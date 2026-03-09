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
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CommercialService } from './commercial.service';
import { AddCommercialMemberDto } from './dto/add-commercial-staff.dto';
import { CreateCommercialEntityDto } from './dto/create-commercial-entity.dto';
import { ListCommercialEntitiesDto } from './dto/list-commercial-entities.dto';
import { SetCommercialMemberPermissionsDto } from './dto/set-commercial-staff-access.dto';
import { UpdateCommercialEntityDto } from './dto/update-commercial-entity.dto';
import { UpdateCommercialMemberDto } from './dto/update-commercial-staff.dto';
import {
  UpdateMemberNationalIdDto,
  UpdateMemberPhotoDto,
} from './dto/update-member-document.dto';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    roles?: string[];
    permissions?: string[];
  };
}

@ApiTags('Commercial')
@Controller('commercial')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class CommercialController {
  constructor(private readonly commercialService: CommercialService) {}

  @Get('entities')
  @Permissions('commercial.view_all', 'admin.view')
  listEntities(@Query() query: ListCommercialEntitiesDto) {
    return this.commercialService.listEntities(query);
  }

  @Post('entities')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('commercial.create', 'admin.update')
  createEntity(@Body() dto: CreateCommercialEntityDto, @Req() req: AuthenticatedRequest) {
    return this.commercialService.createEntity(dto, req.user.id);
  }

  @Get('entities/:entityId')
  @Permissions('commercial.view_all', 'admin.view')
  getEntity(@Param('entityId') entityId: string) {
    return this.commercialService.getEntityById(entityId);
  }

  @Patch('entities/:entityId')
  @Permissions('commercial.update', 'admin.update')
  updateEntity(
    @Param('entityId') entityId: string,
    @Body() dto: UpdateCommercialEntityDto,
  ) {
    return this.commercialService.updateEntity(entityId, dto);
  }

  @Delete('entities/:entityId')
  @HttpCode(HttpStatus.OK)
  @Permissions('commercial.delete', 'admin.update')
  removeEntity(@Param('entityId') entityId: string) {
    return this.commercialService.removeEntity(entityId);
  }

  @Get('entities/:entityId/members')
  @Permissions('commercial.view_all', 'admin.view')
  listMembers(@Param('entityId') entityId: string) {
    return this.commercialService.listMembers(entityId);
  }

  @Post('entities/:entityId/members')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('commercial.update', 'commercial.create', 'admin.update')
  addMember(
    @Param('entityId') entityId: string,
    @Body() dto: AddCommercialMemberDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.commercialService.addMember(entityId, dto, {
      actorUserId: req.user.id,
      actorPermissions: req.user.permissions ?? [],
      actorRoles: req.user.roles ?? [],
    });
  }

  @Patch('members/:memberId')
  @Permissions('commercial.update', 'admin.update')
  updateMember(
    @Param('memberId') memberId: string,
    @Body() dto: UpdateCommercialMemberDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.commercialService.updateMember(memberId, dto, {
      actorUserId: req.user.id,
      actorPermissions: req.user.permissions ?? [],
      actorRoles: req.user.roles ?? [],
    });
  }

  @Delete('members/:memberId')
  @HttpCode(HttpStatus.OK)
  @Permissions('commercial.delete', 'commercial.update', 'admin.update')
  removeMember(
    @Param('memberId') memberId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.commercialService.removeMember(memberId, {
      actorUserId: req.user.id,
      actorPermissions: req.user.permissions ?? [],
      actorRoles: req.user.roles ?? [],
    });
  }

  @Get('members/:memberId/permissions')
  @Permissions('commercial.view_all', 'admin.view')
  getMemberPermissions(@Param('memberId') memberId: string) {
    return this.commercialService.getMemberPermissions(memberId);
  }

  @Put('members/:memberId/permissions')
  @Permissions('commercial.update', 'admin.update')
  setMemberPermissions(
    @Param('memberId') memberId: string,
    @Body() dto: SetCommercialMemberPermissionsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.commercialService.setMemberPermissions(memberId, dto, {
      actorUserId: req.user.id,
      actorPermissions: req.user.permissions ?? [],
      actorRoles: req.user.roles ?? [],
    });
  }

  // ── Audit Logs ────────────────────────────────────────────

  @Get('entities/:entityId/audit-logs')
  @Permissions('commercial.view_all', 'admin.view')
  getAuditLogs(
    @Param('entityId') entityId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.commercialService.getAuditLogs(entityId, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  // ── Member Document Uploads ───────────────────────────────

  @Patch('members/:memberId/photo')
  @Permissions('commercial.update', 'admin.update')
  updateMemberPhoto(
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberPhotoDto,
  ) {
    return this.commercialService.updateMemberPhoto(memberId, dto.photoFileId);
  }

  @Patch('members/:memberId/national-id')
  @Permissions('commercial.update', 'admin.update')
  updateMemberNationalId(
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberNationalIdDto,
  ) {
    return this.commercialService.updateMemberNationalId(
      memberId,
      dto.nationalIdFileId,
    );
  }
}
