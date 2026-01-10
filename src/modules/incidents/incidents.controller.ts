import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { IncidentsQueryDto } from './dto/incidents-query.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('incidents')
@Controller('incidents')
@UseGuards(PermissionsGuard)
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @Permissions('incidents.create')
  @ApiOperation({ summary: 'Create a new incident' })
  @ApiResponse({ status: 201, description: 'Incident created successfully' })
  create(@Body() createIncidentDto: CreateIncidentDto) {
    return this.incidentsService.create(createIncidentDto);
  }

  @Get('cards')
  @Permissions('incidents.view')
  @ApiOperation({ summary: 'Get dashboard cards data' })
  @ApiResponse({ status: 200, description: 'Dashboard cards data' })
  findCards() {
    return this.incidentsService.findCards();
  }

  @Get('list')
  @Permissions('incidents.view')
  @ApiOperation({ summary: 'Get paginated list of incidents' })
  @ApiResponse({ status: 200, description: 'Paginated incidents list' })
  findAll(@Query() query: IncidentsQueryDto) {
    return this.incidentsService.findAll(query);
  }

  @Patch(':id/resolve')
  @Permissions('incidents.resolve')
  @ApiOperation({ summary: 'Resolve an incident' })
  @ApiResponse({ status: 200, description: 'Incident resolved successfully' })
  resolve(@Param('id') id: string) {
    return this.incidentsService.resolve(id);
  }
}
