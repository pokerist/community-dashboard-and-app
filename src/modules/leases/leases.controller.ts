import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { LeasesService } from './leases.service';
import { CreateLeaseDto, UpdateLeaseDto } from './dto/create-lease.dto';

@Controller('leases')
export class LeasesController {
  constructor(private readonly leasesService: LeasesService) {}

  // POST /leases
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
}