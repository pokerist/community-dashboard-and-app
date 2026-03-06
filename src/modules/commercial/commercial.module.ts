import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CommercialController } from './commercial.controller';
import { CommercialService } from './commercial.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CommercialController],
  providers: [CommercialService],
  exports: [CommercialService],
})
export class CommercialModule {}
