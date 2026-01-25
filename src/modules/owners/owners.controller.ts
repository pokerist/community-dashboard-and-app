import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OwnersService } from './owners.service';
import { CreateOwnerWithUnitDto } from './dto/create-owner-with-unit.dto';
import { UpdateProfileDto, UpdateFamilyProfileDto } from './dto/update-profile.dto';
import { CreateLeaseDto, TerminateLeaseDto } from './dto/create-lease.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@Controller('owners')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Post('create-with-unit')
  createWithUnit(
    @Body() dto: CreateOwnerWithUnitDto,
    @Req() req: any,
  ) {
    const createdBy = req.user.id; 
    return this.ownersService.createOwnerWithUnit(dto, createdBy);
  }

  @Get()
  findAll() {
    return this.ownersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ownersService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ownersService.remove(id);
  }

  // ===== PROFILE MANAGEMENT =====

  @Patch('profile')
  updateOwnProfile(@Body() dto: UpdateProfileDto, @Req() req: any) {
    return this.ownersService.updateOwnProfile(req.user.id, dto);
  }

  @Post('upload/profile-photo')
  @UseInterceptors(FileInterceptor('file'))
  uploadProfilePhoto(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    // This would integrate with file service
    // For now, return placeholder
    return { message: 'Profile photo upload endpoint - integrate with file service' };
  }

  @Post('upload/national-id-photo')
  @UseInterceptors(FileInterceptor('file'))
  uploadNationalIdPhoto(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    // This would integrate with file service
    // For now, return placeholder
    return { message: 'National ID photo upload endpoint - integrate with file service' };
  }

  // ===== LEASE MANAGEMENT =====

  @Post('leases')
  createLease(@Body() dto: CreateLeaseDto, @Req() req: any) {
    return this.ownersService.createLease(dto, req.user.id);
  }

  @Post('leases/:leaseId/add-tenant')
  @UseInterceptors(FileInterceptor('nationalIdPhoto'))
  addTenantToLease(
    @Param('leaseId') leaseId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    // File upload would return fileId, for now use placeholder
    const nationalIdPhotoId = 'file-id-placeholder';
    return this.ownersService.addTenantToLease(leaseId, nationalIdPhotoId, req.user.id);
  }

  @Post('leases/:leaseId/terminate')
  terminateLease(
    @Param('leaseId') leaseId: string,
    @Body() dto: TerminateLeaseDto,
    @Req() req: any,
  ) {
    return this.ownersService.terminateLease(leaseId, dto, req.user.id);
  }

  // ===== FAMILY MANAGEMENT =====

  @Post('family/:unitId')
  addFamilyMember(
    @Param('unitId') unitId: string,
    @Body() dto: { name: string; phone: string; email?: string; nationalId?: string; relationship?: string },
    @Req() req: any,
  ) {
    return this.ownersService.addFamilyMember(unitId, dto, req.user.id);
  }

  @Patch('family/:userId')
  updateFamilyProfile(
    @Param('userId') userId: string,
    @Body() dto: UpdateFamilyProfileDto,
    @Req() req: any,
  ) {
    return this.ownersService.updateFamilyProfile(req.user.id, userId, dto);
  }

  @Get('family/:unitId')
  getFamilyMembers(@Param('unitId') unitId: string, @Req() req: any) {
    return this.ownersService.getFamilyMembers(unitId, req.user.id);
  }
}
