import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { GenerateWorkerQrDto } from './dto/generate-worker-qr.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { WorkersService } from './workers.service';

@ApiTags('Workers')
@Controller('workers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Post()
  @ApiOperation({ summary: 'Delegate registers a worker for a unit' })
  create(@Body() dto: CreateWorkerDto, @Req() req: any) {
    return this.workersService.createWorker(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List workers for a unit' })
  list(@Query('unitId') unitId: string, @Req() req: any) {
    return this.workersService.listWorkersForUnit(unitId, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update worker info/status (delegate/admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateWorkerDto, @Req() req: any) {
    return this.workersService.updateWorker(id, dto, req.user.id);
  }

  @Post(':id/qr')
  @ApiOperation({ summary: 'Generate a WORKER QR code for a worker (shift/daily)' })
  generateQr(@Param('id') id: string, @Body() dto: GenerateWorkerQrDto, @Req() req: any) {
    return this.workersService.generateWorkerQr(id, dto, req.user.id);
  }
}

