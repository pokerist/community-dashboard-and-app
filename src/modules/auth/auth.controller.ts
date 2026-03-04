import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  NotFoundException,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SignupWithReferralDto } from '../referrals/dto/signup-with-referral.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { SendPhoneOtpDto } from './dto/send-phone-otp.dto';
import { VerifyPhoneOtpDto } from './dto/verify-phone-otp.dto';
import { UpdateMeProfileDto } from './dto/update-me-profile.dto';
import { UpdateMeProfilePhotoDto } from './dto/update-me-profile-photo.dto';
import { CompleteActivationDto } from './dto/complete-activation.dto';
import { UpdateActivationDraftDto } from './dto/update-activation-draft.dto';
import { VerifyLoginTwoFactorDto } from './dto/verify-login-two-factor.dto';
import { UpdateMeSecurityDto } from './dto/update-me-security.dto';
import {
  CreateProfileChangeRequestDto,
  ReviewProfileChangeRequestDto,
} from './dto/profile-change-request.dto';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { Permissions } from './decorators/permissions.decorator';
import { ProfileChangeRequestStatus } from '@prisma/client';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'User login with email or phone and password' })
  login(@Body() dto: LoginDto) {
    // Pass whichever exists: email or phone
    const identifier = dto.email || dto.phone;
    if (!identifier) {
      throw new BadRequestException('Either email or phone must be provided');
    }
    return this.authService.login(identifier, dto.password);
  }

  @Post('signup-with-referral')
  @ApiOperation({ summary: 'Signup a new user via referral invitation' })
  signupWithReferral(@Body() dto: SignupWithReferralDto) {
    if (process.env.ENABLE_REFERRAL_SIGNUP !== 'true') {
      throw new NotFoundException();
    }
    return this.authService.signupWithReferral(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.userId, dto.refreshToken);
  }

  @Post('login/2fa/verify')
  @ApiOperation({ summary: 'Complete login by verifying 2FA OTP challenge' })
  verifyLoginTwoFactor(@Body() dto: VerifyLoginTwoFactorDto) {
    return this.authService.verifyLoginTwoFactor(dto);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verify email address' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  verifyEmail(@Body() dto: VerifyEmailDto, @Request() req: any) {
    return this.authService.verifyEmail(dto, req.user.id);
  }

  @Post('send-email-verification')
  @ApiOperation({ summary: 'Send an email verification token' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  sendEmailVerification(@Request() req: any) {
    return this.authService.sendEmailVerification(req.user.id);
  }

  @Post('send-phone-otp')
  @ApiOperation({ summary: 'Send OTP to phone for verification' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  sendPhoneOtp(@Body() dto: SendPhoneOtpDto, @Request() req: any) {
    return this.authService.sendPhoneOtp(dto, req.user.id);
  }

  @Post('verify-phone-otp')
  @ApiOperation({ summary: 'Verify phone using OTP' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  verifyPhoneOtp(@Body() dto: VerifyPhoneOtpDto, @Request() req: any) {
    return this.authService.verifyPhoneOtp(dto, req.user.id);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Get authenticated user bootstrap profile (mobile-friendly)',
  })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@Request() req: any) {
    return this.authService.getCurrentUserBootstrap(req.user.id);
  }

  @Patch('me/profile')
  @ApiOperation({ summary: 'Update authenticated user display profile (mobile)' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateMeProfile(@Body() dto: UpdateMeProfileDto, @Request() req: any) {
    return this.authService.updateCurrentUserBasicProfile(req.user.id, dto);
  }

  @Patch('me/profile-photo')
  @ApiOperation({ summary: 'Update authenticated user profile photo directly' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateMeProfilePhoto(@Body() dto: UpdateMeProfilePhotoDto, @Request() req: any) {
    return this.authService.updateCurrentUserProfilePhoto(req.user.id, dto.profilePhotoId);
  }

  @Post('me/profile-change-requests')
  @ApiOperation({
    summary:
      'Submit profile contact update request for admin approval (name/email/phone)',
  })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  createMyProfileChangeRequest(
    @Body() dto: CreateProfileChangeRequestDto,
    @Request() req: any,
  ) {
    return this.authService.createCurrentUserProfileChangeRequest(req.user.id, dto);
  }

  @Get('me/profile-change-requests')
  @ApiOperation({ summary: 'List my profile change requests and their review status' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  listMyProfileChangeRequests(@Request() req: any) {
    return this.authService.listCurrentUserProfileChangeRequests(req.user.id);
  }

  @Get('admin/profile-change-requests')
  @ApiOperation({ summary: 'Admin list of profile change requests' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.view')
  @ApiBearerAuth()
  listProfileChangeRequestsForAdmin(
    @Request() req: any,
    @Query('status') status?: ProfileChangeRequestStatus | 'ALL',
  ) {
    return this.authService.listProfileChangeRequestsForAdmin(req.user.id, status);
  }

  @Patch('admin/profile-change-requests/:id/approve')
  @ApiOperation({ summary: 'Admin approve a profile change request' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.update')
  @ApiBearerAuth()
  approveProfileChangeRequest(@Param('id') id: string, @Request() req: any) {
    return this.authService.approveProfileChangeRequest(id, req.user.id);
  }

  @Patch('admin/profile-change-requests/:id/reject')
  @ApiOperation({ summary: 'Admin reject a profile change request' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.update')
  @ApiBearerAuth()
  rejectProfileChangeRequest(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: ReviewProfileChangeRequestDto,
  ) {
    return this.authService.rejectProfileChangeRequest(
      id,
      req.user.id,
      dto.rejectionReason,
    );
  }

  @Patch('me/security')
  @ApiOperation({ summary: 'Update authenticated user security preferences (mobile)' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateMeSecurity(@Body() dto: UpdateMeSecurityDto, @Request() req: any) {
    return this.authService.updateCurrentUserSecurity(req.user.id, dto);
  }

  @Get('activation/status')
  @ApiOperation({ summary: 'Get first-login activation status for current user' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getActivationStatus(@Request() req: any) {
    return this.authService.getActivationStatus(req.user.id);
  }

  @Post('activation/complete')
  @ApiOperation({ summary: 'Complete first-login activation and set a new password' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  completeActivation(@Body() dto: CompleteActivationDto, @Request() req: any) {
    return this.authService.completeActivation(req.user.id, dto);
  }

  @Patch('activation/draft')
  @ApiOperation({ summary: 'Save activation draft files for current user' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateActivationDraft(
    @Body() dto: UpdateActivationDraftDto,
    @Request() req: any,
  ) {
    return this.authService.updateActivationDraft(req.user.id, dto);
  }
}
