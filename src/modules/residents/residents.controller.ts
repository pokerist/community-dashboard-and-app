import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ResidentService } from './residents.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateResidentDto } from './dto/create-resident.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { UpdateOwnerDto } from './dto/update-owner.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { ApiTags, ApiQuery } from '@nestjs/swagger';

@ApiTags('admin/users')
@Controller('admin/users')
export class ResidentController {
  constructor(private readonly residentService: ResidentService) {}

  // ===== USER MANAGEMENT =====

  // POST /admin/users - Create a new user
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.residentService.createUser(createUserDto);
  }

  // GET /admin/users - List all users with filtering
  @Get()
  @ApiQuery({
    name: 'userType',
    enum: ['resident', 'owner', 'tenant', 'admin'],
    required: false,
  })
  @ApiQuery({ name: 'skip', type: Number, required: false })
  @ApiQuery({ name: 'take', type: Number, required: false })
  findAllUsers(
    @Query('userType') userType?: 'resident' | 'owner' | 'tenant' | 'admin',
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const takeNum = take ? parseInt(take, 10) : 20;
    return this.residentService.findAllUsers(userType, skipNum, takeNum);
  }

  // GET /admin/users/:id - Get a single user with all relations
  @Get(':id')
  getUser(@Param('id') id: string) {
    return this.residentService.getUserWithRelations(id);
  }

  // PATCH /admin/users/:id - Update a user
  @Patch(':id')
  updateUser(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.residentService.updateUser(id, updateUserDto);
  }

  // DELETE /admin/users/:id - Deactivate a user
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivateUser(@Param('id') id: string) {
    return this.residentService.deactivateUser(id);
  }

  // ===== RESIDENT MANAGEMENT =====

  // POST /admin/residents - Create a resident profile
  @Post('residents')
  @HttpCode(HttpStatus.CREATED)
  createResident(@Body() createResidentDto: CreateResidentDto) {
    return this.residentService.createResident(createResidentDto);
  }

  // GET /admin/residents - List all residents
  @Get('residents')
  @ApiQuery({ name: 'skip', type: Number, required: false })
  @ApiQuery({ name: 'take', type: Number, required: false })
  findAllResidents(@Query('skip') skip?: string, @Query('take') take?: string) {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const takeNum = take ? parseInt(take, 10) : 20;
    return this.residentService.findAllResidents(skipNum, takeNum);
  }

  // GET /admin/residents/:id - Get a single resident
  @Get('residents/:id')
  getResident(@Param('id') id: string) {
    return this.residentService.getResident(id);
  }

  // PATCH /admin/residents/:id - Update a resident
  @Patch('residents/:id')
  updateResident(
    @Param('id') id: string,
    @Body() updateResidentDto: UpdateResidentDto,
  ) {
    return this.residentService.updateResident(id, updateResidentDto);
  }

  // DELETE /admin/residents/:id - Delete a resident profile
  @Delete('residents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteResident(@Param('id') id: string) {
    return this.residentService.deleteResident(id);
  }

  // ===== OWNER MANAGEMENT =====

  // POST /admin/owners - Create an owner profile
  @Post('owners')
  @HttpCode(HttpStatus.CREATED)
  createOwner(@Body() createOwnerDto: CreateOwnerDto) {
    return this.residentService.createOwner(createOwnerDto);
  }

  // GET /admin/owners - List all owners
  @Get('owners')
  @ApiQuery({ name: 'skip', type: Number, required: false })
  @ApiQuery({ name: 'take', type: Number, required: false })
  findAllOwners(@Query('skip') skip?: string, @Query('take') take?: string) {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const takeNum = take ? parseInt(take, 10) : 20;
    return this.residentService.findAllOwners(skipNum, takeNum);
  }

  // GET /admin/owners/:id - Get a single owner
  @Get('owners/:id')
  getOwner(@Param('id') id: string) {
    return this.residentService.getOwner(id);
  }

  // PATCH /admin/owners/:id - Update an owner
  @Patch('owners/:id')
  updateOwner(@Param('id') id: string, @Body() updateOwnerDto: UpdateOwnerDto) {
    return this.residentService.updateOwner(id, updateOwnerDto);
  }

  // DELETE /admin/owners/:id - Delete an owner profile
  @Delete('owners/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteOwner(@Param('id') id: string) {
    return this.residentService.deleteOwner(id);
  }

  // ===== TENANT MANAGEMENT =====

  // POST /admin/tenants - Create a tenant profile
  @Post('tenants')
  @HttpCode(HttpStatus.CREATED)
  createTenant(@Body() createTenantDto: CreateTenantDto) {
    return this.residentService.createTenant(createTenantDto);
  }

  // GET /admin/tenants - List all tenants
  @Get('tenants')
  @ApiQuery({ name: 'skip', type: Number, required: false })
  @ApiQuery({ name: 'take', type: Number, required: false })
  findAllTenants(@Query('skip') skip?: string, @Query('take') take?: string) {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const takeNum = take ? parseInt(take, 10) : 20;
    return this.residentService.findAllTenants(skipNum, takeNum);
  }

  // GET /admin/tenants/:id - Get a single tenant
  @Get('tenants/:id')
  getTenant(@Param('id') id: string) {
    return this.residentService.getTenant(id);
  }

  // PATCH /admin/tenants/:id - Update a tenant
  @Patch('tenants/:id')
  updateTenant(
    @Param('id') id: string,
    @Body() updateTenantDto: UpdateTenantDto,
  ) {
    return this.residentService.updateTenant(id, updateTenantDto);
  }

  // DELETE /admin/tenants/:id - Delete a tenant profile
  @Delete('tenants/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTenant(@Param('id') id: string) {
    return this.residentService.deleteTenant(id);
  }

  // ===== ADMIN MANAGEMENT =====

  // POST /admin/admins - Create an admin profile
  @Post('admins')
  @HttpCode(HttpStatus.CREATED)
  createAdmin(@Body() createAdminDto: CreateAdminDto) {
    return this.residentService.createAdmin(createAdminDto);
  }

  // GET /admin/admins - List all admins
  @Get('admins')
  @ApiQuery({ name: 'skip', type: Number, required: false })
  @ApiQuery({ name: 'take', type: Number, required: false })
  findAllAdmins(@Query('skip') skip?: string, @Query('take') take?: string) {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const takeNum = take ? parseInt(take, 10) : 20;
    return this.residentService.findAllAdmins(skipNum, takeNum);
  }

  // GET /admin/admins/:id - Get a single admin
  @Get('admins/:id')
  getAdmin(@Param('id') id: string) {
    return this.residentService.getAdmin(id);
  }

  // PATCH /admin/admins/:id - Update an admin
  @Patch('admins/:id')
  updateAdmin(@Param('id') id: string, @Body() updateAdminDto: UpdateAdminDto) {
    return this.residentService.updateAdmin(id, updateAdminDto);
  }

  // DELETE /admin/admins/:id - Delete an admin profile
  @Delete('admins/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAdmin(@Param('id') id: string) {
    return this.residentService.deleteAdmin(id);
  }
}
