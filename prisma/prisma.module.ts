import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // <--- This makes the DB available everywhere automatically
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // <--- Exports it so other modules can use it
})
export class PrismaModule {}