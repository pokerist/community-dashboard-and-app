import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ResidentService } from './residents.service';
import { CreateResidentDto } from './dto/create-resident.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';
import { ApiTags, ApiQuery } from '@nestjs/swagger';
import { Role } from '@prisma/client';

@ApiTags('users')
@Controller('users')
export class ResidentController {
  constructor(private readonly residentService: ResidentService) {}

  // POST /users
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUserDto: CreateResidentDto) {
    return this.residentService.create(createUserDto);
  }

  // GET /users (List with filtering/pagination)
  @Get()
  @ApiQuery({ name: 'role', enum: Role, required: false })
  @ApiQuery({ name: 'skip', type: Number, required: false })
  @ApiQuery({ name: 'take', type: Number, required: false })
  findAll(
    @Query('role') role?: Role,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    // Note: Query parameters come in as strings, convert to numbers
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const takeNum = take ? parseInt(take, 10) : 20;

    return this.residentService.findAll(role, skipNum, takeNum);
  }

  // GET /users/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.residentService.findOne(id);
  }

  // PATCH /users/:id
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateData: UpdateResidentDto) {
    return this.residentService.update(id, updateData);
  }

  // DELETE /users/:id (Deactivate)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivate(@Param('id') id: string) {
    return this.residentService.deactivate(id);
  }
  
  // Endpoint to list units assigned to the user (uses the findOne service method's included data)
  @Get(':id/units')
  async listUnits(@Param('id') id: string) {
    const user = await this.residentService.findOne(id);
    return user.residentUnits; // Returns the nested units data
  }
}