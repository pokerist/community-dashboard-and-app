import { Module } from '@nestjs/common';
import { ServiceService } from './service.service';
import { ServiceController } from './service.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ServiceController],
  providers: [ServiceService],
  exports: [ServiceService],
})
export class ServiceModule {}
