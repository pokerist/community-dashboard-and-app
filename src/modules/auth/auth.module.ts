import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { PermissionCacheService } from './permission-cache.service';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { NotificationsModule } from '../notifications/notifications.module';


@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'defaultSecretKey',
      signOptions: { expiresIn: '15m' },
    }),
    forwardRef(() => ReferralsModule),
    forwardRef(() => NotificationsModule),
  ],
  providers: [
    AuthService,
    JwtAuthGuard,
    JwtStrategy,
    PermissionsGuard,
    PermissionCacheService,
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtModule, PermissionCacheService],
})
export class AuthModule {}
