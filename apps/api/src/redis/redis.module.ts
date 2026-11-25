import {
  Global,
  Inject,
  Logger,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { APP_CONFIG, type AppConfig } from '../config/config.js';

/** Injection token for the shared Redis connection. */
export const REDIS = Symbol('REDIS');

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): Redis => {
        const logger = new Logger('Redis');
        const redis = new Redis(config.REDIS_URL, {
          lazyConnect: true,
          // Fail fast instead of queueing commands while Redis is unreachable;
          // /readyz then reports Redis as down rather than hanging.
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
        });
        redis.on('error', (error: Error) => logger.warn(`Redis error: ${error.message}`));
        return redis;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Redis');

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /**
   * Wait briefly for the first connection so the app is ready as soon as it starts.
   * If Redis is unreachable, start anyway: /readyz reports it and ioredis keeps retrying.
   */
  async onModuleInit(): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timed out after 2s')), 2000);
    });
    try {
      await Promise.race([this.redis.connect(), timeout]);
    } catch (error) {
      this.logger.warn(`Starting without Redis: ${(error as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
