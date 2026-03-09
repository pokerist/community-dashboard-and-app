import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { ModuleAccessGuard } from './guards/module-access.guard';
import { PermissionCacheService } from './permission-cache.service';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { AccessResolverService } from './access-resolver.service';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'defaultSecretKey',
      signOptions: {
        expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '12h') as any,
      },
    }),
    forwardRef(() => ReferralsModule),
    forwardRef(() => NotificationsModule),
    forwardRef(() => SystemSettingsModule),
  ],
  providers: [
    AuthService,
    JwtAuthGuard,
    JwtStrategy,
    PermissionsGuard,
    ModuleAccessGuard,
    PermissionCacheService,
    AccessResolverService,
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtModule, PermissionCacheService, AccessResolverService],
})
export class AuthModule {}
