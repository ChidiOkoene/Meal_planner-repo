import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { type FastifyReply } from 'fastify';
import { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service.js';
import { REDIS } from '../redis/redis.module.js';

type CheckStatus = 'up' | 'down';

const CHECK_TIMEOUT_MS = 2000;

/** Liveness and readiness probes for the hosting platform. Not versioned, not rate limited. */
@ApiExcludeController()
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** The process is running. Never checks dependencies, so a database outage doesn't restart it. */
  @Get('healthz')
  liveness() {
    return { status: 'ok' };
  }

  /** The process can serve traffic: database and Redis both respond. */
  @Get('readyz')
  async readiness(@Res({ passthrough: true }) reply: FastifyReply) {
    const [database, redis] = await Promise.all([
      check(() => this.prisma.$queryRaw`SELECT 1`),
      check(() => this.redis.ping()),
    ]);
    const ready = database === 'up' && redis === 'up';
    void reply.status(ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return { status: ready ? 'ok' : 'unavailable', checks: { database, redis } };
  }
}

async function check(probe: () => Promise<unknown>): Promise<CheckStatus> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS);
  });
  try {
    await Promise.race([probe(), timeout]);
    return 'up';
  } catch {
    return 'down';
  } finally {
    clearTimeout(timer);
  }
}
