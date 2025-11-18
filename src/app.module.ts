import { Module } from '@nestjs/common';

// 1. Core Feature Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { UnitsModule } from './modules/units/units.module';

// 2. Utility Modules (For services used across features)
import { SupabaseModule } from './modules/supabase/supabase.module';
// import { NotificationsModule } from './modules/notifications/notifications.module';
// Note: PrismaService is typically provided directly in feature modules,
// but a dedicated PrismaModule can also be used if preferred.

@Module({
  imports: [
    // Core Application Features
    AuthModule, 
    UnitsModule, 
    UsersModule,

    // Global Utility Services
    SupabaseModule,
    // NotificationsModule,
    
    // Add other modules (Services, Payments, Access Control) as you create them
  ],
  controllers: [], // Usually empty; feature controllers are imported via their modules
  providers: [],   // Usually empty; services are imported via their modules
})
export class AppModule {}