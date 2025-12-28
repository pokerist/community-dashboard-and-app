// prisma.service.ts
import {
  INestApplication,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private static instance: PrismaService;

  constructor() {
    if (PrismaService.instance) {
      return PrismaService.instance; // reuse existing client
    }
    super({
      log: ['query', 'info', 'warn', 'error'],
      errorFormat: 'minimal',
      //@ts-ignore
      __internal: {
        // This is the key: disable prepared statements
        engine: {
          disablePreparedStatements: true,
        },
      } as any,
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication) {
    (this.$on as any)('beforeExit', async () => {
      await app.close();
    });
  }
}
