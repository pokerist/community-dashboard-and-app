import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreatePermitFieldDto } from './dto/create-permit-field.dto';
import { CreatePermitTypeDto } from './dto/create-permit-type.dto';
import { UpdatePermitTypeDto } from './dto/update-permit-type.dto';
import { PermitsService } from './permits.service';

@ApiBearerAuth()
@ApiTags('Permit Types')
@Controller('permit-types')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermitTypesController {
  constructor(private readonly permitsService: PermitsService) {}

  @Get()
  @ApiOperation({ summary: 'List permit types' })
  @Permissions('service.read')
  listPermitTypes(@Query('includeInactive') includeInactive?: string) {
    return this.permitsService.listPermitTypes(includeInactive === 'true');
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Get permit type by ID or slug' })
  @Permissions('service.read')
  getPermitType(@Param('idOrSlug') idOrSlug: string) {
    return this.permitsService.getPermitType(idOrSlug);
  }

  @Post()
  @ApiOperation({ summary: 'Create permit type' })
  @Permissions('service.create')
  createPermitType(@Body() dto: CreatePermitTypeDto) {
    return this.permitsService.createPermitType(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update permit type' })
  @Permissions('service.update')
  updatePermitType(@Param('id') id: string, @Body() dto: UpdatePermitTypeDto) {
    return this.permitsService.updatePermitType(id, dto);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle permit type active state' })
  @Permissions('service.update')
  togglePermitType(@Param('id') id: string) {
    return this.permitsService.togglePermitType(id);
  }

  @Post(':id/fields')
  @ApiOperation({ summary: 'Add field to permit type' })
  @Permissions('service.update')
  addField(@Param('id') permitTypeId: string, @Body() dto: CreatePermitFieldDto) {
    return this.permitsService.addField(permitTypeId, dto);
  }

  @Delete('fields/:fieldId')
  @ApiOperation({ summary: 'Remove permit field' })
  @Permissions('service.update')
  removeField(@Param('fieldId') fieldId: string) {
    return this.permitsService.removeField(fieldId);
  }
}
