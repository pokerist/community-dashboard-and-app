import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { LeasesService } from './leases.service';
import { CreateLeaseDto, UpdateLeaseDto } from './dto/create-lease.dto';
import { AddTenantToLeaseDto } from './dto/add-tenant-to-lease.dto';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('leases')
@Controller('leases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LeasesController {
  constructor(private readonly leasesService: LeasesService) {}

  // POSTh /leases
  @Post()
  create(@Body() createLeaseDto: CreateLeaseDto) {
    return this.leasesService.create(createLeaseDto);
  }

  // GET /leases
  @Get()
  findAll() {
    return this.leasesService.findAll();
  }

  // GET /leases/unit/:unitId
  // (Fulfills your "GET /units/:unitId/leases" requirement)
  @Get('unit/:unitId')
  findByUnit(@Param('unitId') unitId: string) {
    return this.leasesService.findByUnit(unitId);
  }

  // GET /leases/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.leasesService.findOne(id);
  }

  // PATCH /leases/:id
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLeaseDto: UpdateLeaseDto) {
    return this.leasesService.update(id, updateLeaseDto);
  }

  // DELETE /leases/:id
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.leasesService.remove(id);
  }

  // POST /leases/:leaseId/add-tenant
  @Post(':leaseId/add-tenant')
  @UseInterceptors(FileInterceptor('nationalIdPhoto'))
  addTenantToLease(
    @Param('leaseId') leaseId: string,
    @Body() addTenantDto: AddTenantToLeaseDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    // File upload would return fileId, for now use placeholder
    const nationalIdPhotoId = 'file-id-placeholder';
    return this.leasesService.addTenantToLease(
      leaseId,
      addTenantDto,
      req.user.id,
    );
  }

  // POST /leases/:leaseId/terminate
  @Post(':leaseId/terminate')
  terminateLease(
    @Param('leaseId') leaseId: string,
    @Body() dto: { reason?: string; terminationDate?: string },
    @Req() req: any,
  ) {
    return this.leasesService.terminateLease(leaseId, dto, req.user.id);
  }
}
