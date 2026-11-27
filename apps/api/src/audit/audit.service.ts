import { Inject, Injectable } from '@nestjs/common';
import { type AuditActorType, type Prisma } from '@dyjext/db';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuditEntry {
  actorType: AuditActorType;
  actorUserId?: string | null;
  /** What happened, e.g. "health_profile.viewed", "meal_plan.approved". */
  action: string;
  entityType: string;
  entityId: string;
  requestId?: string;
  /** Context only. Never put health details or phone numbers here. */
  metadata?: Prisma.InputJsonValue;
}

/**
 * Writes the append-only audit log (docs/ARCHITECTURE.md §15). The database refuses updates
 * and deletes on audit_log, so entries can't be altered after the fact.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Record an entry. Pass `tx` to commit it together with the change it describes. */
  async record(entry: AuditEntry, tx?: Prisma.TransactionClient): Promise<void> {
    await (tx ?? this.prisma).auditLog.create({
      data: {
        actorType: entry.actorType,
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        requestId: entry.requestId ?? null,
        metadata: entry.metadata,
      },
    });
  }
}
