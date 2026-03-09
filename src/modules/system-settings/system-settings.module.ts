import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AdminSettingsCompatController } from './admin-settings-compat.controller';
import { IntegrationConfigService } from './integration-config.service';
import { MobileAppConfigController } from './mobile-app-config.controller';
import { SystemSettingsController } from './system-settings.controller';
import { SystemSettingsService } from './system-settings.service';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [
    SystemSettingsController,
    MobileAppConfigController,
    AdminSettingsCompatController,
  ],
  providers: [SystemSettingsService, IntegrationConfigService],
  exports: [SystemSettingsService, IntegrationConfigService],
})
export class SystemSettingsModule {}
