import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiTags, ApiQuery } from '@nestjs/swagger';
import { Role } from '@prisma/client';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // POST /users
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
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

    return this.usersService.findAll(role, skipNum, takeNum);
  }

  // GET /users/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  // PATCH /users/:id
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateData: UpdateUserDto) {
    return this.usersService.update(id, updateData);
  }

  // DELETE /users/:id (Deactivate)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }
  
  // Endpoint to list units assigned to the user (uses the findOne service method's included data)
  @Get(':id/units')
  async listUnits(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    return user.residentUnits; // Returns the nested units data
  }
}