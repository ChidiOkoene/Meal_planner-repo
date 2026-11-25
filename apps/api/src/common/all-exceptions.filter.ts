import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type ApiError } from '@dyjext/shared';
import { type FastifyReply, type FastifyRequest } from 'fastify';
import { ValidationFailedException } from './errors.js';

const CODES: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  405: 'method_not_allowed',
  409: 'conflict',
  413: 'payload_too_large',
  415: 'unsupported_media_type',
  422: 'unprocessable_entity',
  429: 'too_many_requests',
  503: 'service_unavailable',
};

/**
 * Renders every error in one shape (`ApiError`). Unexpected errors are logged with their
 * stack trace but clients only ever see a generic message, never internal details.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const reply = http.getResponse<FastifyReply>();
    const request = http.getRequest<FastifyRequest>();
    const requestId = request.id;

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ApiError = {
      error: { code: 'internal_error', message: 'Something went wrong', requestId },
    };

    if (exception instanceof ValidationFailedException) {
      status = HttpStatus.BAD_REQUEST;
      body = {
        error: {
          code: 'validation_failed',
          message: 'Request validation failed',
          details: exception.details,
          requestId,
        },
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      body = {
        error: {
          code: CODES[status] ?? (status >= 500 ? 'internal_error' : 'bad_request'),
          message: status >= 500 ? 'Something went wrong' : exception.message,
          requestId,
        },
      };
    } else if (isFastifyClientError(exception)) {
      // e.g. malformed JSON or an unsupported content type, raised by Fastify before routing.
      status = exception.statusCode;
      body = {
        error: { code: CODES[status] ?? 'bad_request', message: exception.message, requestId },
      };
    }

    if (status >= 500) {
      this.logger.error(
        { err: exception, requestId },
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    void reply.status(status).send(body);
  }
}

function isFastifyClientError(error: unknown): error is Error & { statusCode: number } {
  return (
    error instanceof Error &&
    'statusCode' in error &&
    typeof error.statusCode === 'number' &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  );
}
