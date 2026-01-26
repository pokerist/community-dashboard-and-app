import { Module } from '@nestjs/common';
import { OwnersService } from './owners.service';
import { OwnersController } from './owners.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorityResolver } from '../../common/utils/authority-resolver.util';

@Module({
  imports: [PrismaModule, NotificationsModule, AuthModule],
  controllers: [OwnersController],
  providers: [OwnersService, AuthorityResolver],
  exports: [OwnersService],
})
export class OwnersModule {}
