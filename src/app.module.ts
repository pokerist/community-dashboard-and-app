import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { UsersModule } from './modules/users/users.module';
import { UnitsModule } from './modules/units/units.module';

@Module({
  imports: [PrismaModule, InvoicesModule, UnitsModule, UsersModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
