import { Controller, Post, Body, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { SignupWithReferralDto } from '../referrals/dto/signup-with-referral.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { SendPhoneOtpDto } from './dto/send-phone-otp.dto';
import { VerifyPhoneOtpDto } from './dto/verify-phone-otp.dto';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

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
      throw new Error('Either email or phone must be provided');
    }
    return this.authService.login(identifier, dto.password);
  }

  // @Post('register')
  // @ApiOperation({ summary: 'Register a new user' })
  // register(@Body() dto: RegisterDto) {
  //   return this.authService.register(dto.email, dto.password, dto.nameEN, dto.nameAR);
  // }

  @Post('signup-with-referral')
  @ApiOperation({ summary: 'Signup a new user via referral invitation' })
  signupWithReferral(@Body() dto: SignupWithReferralDto) {
    return this.authService.signupWithReferral(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.userId, dto.refreshToken);
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
    return this.authService.verifyEmail(dto, req.user.sub);
  }

  @Post('send-phone-otp')
  @ApiOperation({ summary: 'Send OTP to phone for verification' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  sendPhoneOtp(@Body() dto: SendPhoneOtpDto, @Request() req: any) {
    return this.authService.sendPhoneOtp(dto, req.user.sub);
  }

  @Post('verify-phone-otp')
  @ApiOperation({ summary: 'Verify phone using OTP' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  verifyPhoneOtp(@Body() dto: VerifyPhoneOtpDto, @Request() req: any) {
    return this.authService.verifyPhoneOtp(dto, req.user.sub);
  }
}
