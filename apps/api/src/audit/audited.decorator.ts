import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
  SetMetadata,
  UseInterceptors,
  applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type FastifyRequest } from 'fastify';
import { from, type Observable, switchMap } from 'rxjs';
import { AuditService } from './audit.service.js';

const AUDITED = Symbol('AUDITED');

interface AuditedOptions {
  action: string;
  entityType: string;
  /** Route parameter holding the entity id. Default "id". */
  idParam?: string;
}

/**
 * Record an audit entry each time this route succeeds, e.g. reading a health profile.
 * Fails closed: if the entry can't be written, the response is not sent.
 *
 *   @Audited({ action: 'health_profile.viewed', entityType: 'health_profile' })
 */
export function Audited(options: AuditedOptions) {
  return applyDecorators(SetMetadata(AUDITED, options), UseInterceptors(AuditInterceptor));
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<AuditedOptions | undefined>(AUDITED, context.getHandler());
    if (!options) return next.handle();
    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: { id: string } }>();
    const params = request.params as Record<string, string | undefined>;
    const entityId = params[options.idParam ?? 'id'];

    return next.handle().pipe(
      switchMap((result: unknown) =>
        from(
          (async () => {
            if (entityId) {
              await this.audit.record({
                // Staff sign-in (issue #8) sets request.user; until then the actor is unknown.
                actorType: 'user',
                actorUserId: request.user?.id ?? null,
                action: options.action,
                entityType: options.entityType,
                entityId,
                requestId: request.id,
              });
            }
            return result;
          })(),
        ),
      ),
    );
  }
}
