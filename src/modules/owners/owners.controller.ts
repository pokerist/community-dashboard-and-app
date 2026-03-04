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
import { AddOwnerUnitsDto } from './dto/add-owner-units.dto';
import { AddFamilyMemberDto } from './dto/add-family-member.dto';
import {
  UpdateProfileDto,
  UpdateFamilyProfileDto,
} from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { OwnerInstallmentStatus } from '@prisma/client';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('owners')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Post('create-with-unit')
  @Permissions('owner.create')
  createWithUnit(@Body() dto: CreateOwnerWithUnitDto, @Req() req: any) {
    const createdBy = req.user.id;
    return this.ownersService.createOwnerWithUnit(dto, createdBy);
  }

  @Post(':ownerUserId/units')
  @Permissions('owner.update')
  addUnitsToOwner(
    @Param('ownerUserId') ownerUserId: string,
    @Body() dto: AddOwnerUnitsDto,
    @Req() req: any,
  ) {
    return this.ownersService.addUnitsToExistingOwner(ownerUserId, dto, req.user.id);
  }

  @Get()
  @Permissions('owner.view')
  findAll() {
    return this.ownersService.findAll();
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
    return this.ownersService.uploadOwnProfilePhoto(req.user.id, file);
  }

  @Post('upload/national-id-photo')
  @UseInterceptors(FileInterceptor('file'))
  uploadNationalIdPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.ownersService.uploadOwnNationalIdPhoto(req.user.id, file);
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

  @Get('payment-plans/installments')
  @Permissions('owner.view')
  listInstallments(
    @Query('status') status?: OwnerInstallmentStatus | 'ALL',
    @Query('dueBefore') dueBefore?: string,
    @Query('dueAfter') dueAfter?: string,
    @Query('ownerUserId') ownerUserId?: string,
    @Query('unitId') unitId?: string,
    @Query('onlyOverdue') onlyOverdue?: string,
  ) {
    return this.ownersService.listOwnerInstallmentsForAdmin({
      status,
      dueBefore,
      dueAfter,
      ownerUserId,
      unitId,
      onlyOverdue: String(onlyOverdue).toLowerCase() === 'true',
    });
  }

  @Patch('payment-plans/installments/:installmentId/mark-paid')
  @Permissions('owner.update')
  markInstallmentPaid(
    @Param('installmentId') installmentId: string,
    @Body() body: { paidAt?: string; notes?: string },
    @Req() req: any,
  ) {
    return this.ownersService.markOwnerInstallmentPaid(
      installmentId,
      req.user.id,
      body?.paidAt,
      body?.notes,
    );
  }

  @Post('payment-plans/installments/:installmentId/send-reminder')
  @Permissions('owner.update')
  sendInstallmentReminder(
    @Param('installmentId') installmentId: string,
    @Req() req: any,
  ) {
    return this.ownersService.sendOwnerInstallmentReminder(
      installmentId,
      req.user.id,
    );
  }

  @Get(':id')
  @Permissions('owner.view')
  findOne(@Param('id') id: string) {
    return this.ownersService.findOne(id);
  }

  @Delete(':id')
  @Permissions('owner.delete')
  remove(@Param('id') id: string) {
    return this.ownersService.remove(id);
  }
}
