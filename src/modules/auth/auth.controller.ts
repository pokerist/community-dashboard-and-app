import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

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

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.userId, dto.refreshToken);
  }
}
