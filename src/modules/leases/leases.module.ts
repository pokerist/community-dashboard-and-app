import { Module } from '@nestjs/common';
import { LeasesService } from './leases.service';
import { LeasesController } from './leases.controller';

@Module({
  providers: [LeasesService],
  controllers: [LeasesController]
})
export class LeasesModule {}
