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
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OwnersService } from './owners.service';
import { CreateOwnerWithUnitDto } from './dto/create-owner-with-unit.dto';
import { AddFamilyMemberDto } from './dto/add-family-member.dto';
import {
  UpdateProfileDto,
  UpdateFamilyProfileDto,
} from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AuthorityResolver } from '../../common/utils/authority-resolver.util';

@Controller('owners')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Post('create-with-unit')
  createWithUnit(@Body() dto: CreateOwnerWithUnitDto, @Req() req: any) {
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

  // Remove a user from a unit (for family/tenants)
  @Post('units/:unitId/remove-user/:userId')
  removeUserFromUnit(
    @Param('unitId') unitId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    return this.ownersService.removeUserFromUnit(userId, unitId, req.user.id);
  }

  // ===== PROFILE MANAGEMENT =====

  @Patch('profile')
  updateOwnProfile(@Body() dto: UpdateProfileDto, @Req() req: any) {
    return this.ownersService.updateOwnProfile(req.user.id, dto);
  }

  @Post('upload/profile-photo')
  @UseInterceptors(FileInterceptor('file'))
  uploadProfilePhoto(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    // This would integrate with file service
    // For now, return placeholder
    return {
      message: 'Profile photo upload endpoint - integrate with file service',
    };
  }

  @Post('upload/national-id-photo')
  @UseInterceptors(FileInterceptor('file'))
  uploadNationalIdPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    // This would integrate with file service
    // For now, return placeholder
    return {
      message:
        'National ID photo upload endpoint - integrate with file service',
    };
  }

  // ===== FAMILY MANAGEMENT =====

  @Post('family/:unitId')
  addFamilyMember(
    @Param('unitId') unitId: string,
    @Query('targetResidentId') targetResidentId: string,
    @Body() dto: AddFamilyMemberDto,
    @Req() req: any,
  ) {
    return this.ownersService.addFamilyMember(unitId, dto, req.user.id, targetResidentId);
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
