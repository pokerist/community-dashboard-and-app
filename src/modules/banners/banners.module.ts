import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { BannersController } from './banners.controller';
import { BannersService } from './banners.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BannersController],
  providers: [BannersService],
  exports: [BannersService],
})
export class BannersModule {}

