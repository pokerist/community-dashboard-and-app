import { Module } from '@nestjs/common';
import { ViolationsModule } from './modules/violations/violations.module';

@Module({
  imports: [ViolationsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
