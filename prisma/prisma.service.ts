import { INestApplication, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {

  // 1. Initialize the client
  constructor() {
    super({
      log: ['query', 'info', 'warn', 'error'], // Good for debugging SQL queries
    });
  }

  // 2. Connect when the module initializes (NestJS lifecycle hook)
  async onModuleInit() {
    await this.$connect();
  }

  // 3. Disconnect when the module is shutting down (Clean-up)
  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Optional: Allows a graceful shutdown hook (for use in main.ts)
  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit' as never, async () => {
      await app.close();
    });
  }
}