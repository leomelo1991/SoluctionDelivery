import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { config } from './config.js';
@Injectable()
export class Database extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: config.DATABASE_URL,
        max: config.DB_POOL_MAX,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000,
      }),
    });
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
