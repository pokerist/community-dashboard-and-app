import { Module } from '@nestjs/common';
import { LeasesModule } from './modules/leases/leases.module';

@Module({
  imports: [LeasesModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
