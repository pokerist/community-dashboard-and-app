import { Module } from '@nestjs/common';
import { LeasesModule } from './modules/leases/leases.module';
import { PrismaModule } from '../prisma/prisma.module';
@Module({
  imports: [
    PrismaModule,
    LeasesModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
