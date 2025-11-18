import { Module } from '@nestjs/common';
import { UsersModule } from './modules/residents/residents.module';

@Module({
  imports: [UsersModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
