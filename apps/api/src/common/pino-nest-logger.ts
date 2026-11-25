import { type LoggerService } from '@nestjs/common';
import { type FastifyBaseLogger } from 'fastify';

/** Sends Nest's own log lines (startup, routing, errors) through Fastify's pino logger. */
export class PinoNestLogger implements LoggerService {
  constructor(private readonly pino: FastifyBaseLogger) {}

  log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }
  error(message: unknown, stackOrContext?: string, context?: string): void {
    this.write('error', message, context ?? stackOrContext);
  }
  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }
  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }
  verbose(message: unknown, context?: string): void {
    this.write('trace', message, context);
  }
  fatal(message: unknown, context?: string): void {
    this.write('fatal', message, context);
  }

  private write(
    level: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace',
    message: unknown,
    context?: string,
  ) {
    if (typeof message === 'object' && message !== null) {
      this.pino[level]({ context, ...message });
    } else {
      this.pino[level]({ context }, String(message));
    }
  }
}
