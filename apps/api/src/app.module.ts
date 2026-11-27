import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CatalogueModule } from './catalogue/catalogue.module.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { APP_CONFIG, type AppConfig } from './config/config.js';
import { HealthModule } from './health/health.module.js';
import { MetaModule } from './meta/meta.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';

/** Root module. Feature modules (households, catalogue, planning, ...) are added here. */
@Module({})
export class AppModule {
  static register(config: AppConfig, extraModules: DynamicModule['imports'] = []): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: config.RATE_LIMIT_PER_MINUTE }]),
        PrismaModule,
        RedisModule,
        HealthModule,
        MetaModule,
        CatalogueModule,
        ...extraModules,
      ],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
      exports: [APP_CONFIG],
    };
  }
}
