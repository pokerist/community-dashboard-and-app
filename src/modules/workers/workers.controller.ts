import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { GenerateWorkerQrDto } from './dto/generate-worker-qr.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { WorkersService } from './workers.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

@ApiTags('Workers')
@Controller('workers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Post()
  @Permissions('worker.create')
  @ApiOperation({ summary: 'Delegate registers a worker for a unit' })
  create(@Body() dto: CreateWorkerDto, @Req() req: AuthenticatedRequest) {
    return this.workersService.createWorker(dto, req.user.id);
  }

  @Get()
  @Permissions('worker.view_all', 'worker.view_own')
  @ApiOperation({ summary: 'List workers for a unit' })
  list(@Query('unitId') unitId: string, @Req() req: AuthenticatedRequest) {
    return this.workersService.listWorkersForUnit(unitId, req.user.id);
  }

  @Patch(':id')
  @Permissions('worker.update')
  @ApiOperation({ summary: 'Update worker info/status (delegate/admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateWorkerDto, @Req() req: AuthenticatedRequest) {
    return this.workersService.updateWorker(id, dto, req.user.id);
  }

  @Post(':id/qr')
  @Permissions('worker.generate_qr')
  @ApiOperation({ summary: 'Generate a WORKER QR code for a worker (shift/daily)' })
  generateQr(@Param('id') id: string, @Body() dto: GenerateWorkerQrDto, @Req() req: AuthenticatedRequest) {
    return this.workersService.generateWorkerQr(id, dto, req.user.id);
  }
}
