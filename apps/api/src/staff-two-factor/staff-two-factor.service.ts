import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  decryptValue,
  encryptValue,
  type KeyProvider,
  LocalKeyProvider,
  type StaffTwoFactorMethod,
} from '@dyjext/db';
import { AuditService } from '../audit/audit.service.js';
import { type AuthUser } from '../auth/auth-user.js';
import { APP_CONFIG, type AppConfig } from '../config/config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BACKUP_CODE_COUNT,
  generateBackupCode,
  generateSecret,
  hashBackupCode,
  looksLikeBackupCode,
  otpauthUri,
  verifyCode,
} from './totp.js';

/** How long one check unlocks the staff console for a sign-in session. */
export const UNLOCK_HOURS = 12;
/** Wrong codes in a row before the check locks. */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;
const ISSUER = 'Dyjext Care';

/**
 * Staff 2-step verification with an authenticator app, built in so it works on any plan of the
 * auth provider. The provider proves the password or email code; this adds the second step.
 * A successful check unlocks the staff console for that sign-in session only.
 */
@Injectable()
export class StaffTwoFactorService {
  private keys: KeyProvider | undefined;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Whether this sign-in session has passed the authenticator check and not expired. */
  async isSessionUnlocked(userId: string, sessionId: string | null): Promise<boolean> {
    if (!sessionId) return false;
    const session = await this.prisma.staffTwoFactorSession.findUnique({
      where: { sessionId },
    });
    return Boolean(session && session.userId === userId && session.expiresAt > new Date());
  }

  async status(user: AuthUser) {
    const record = await this.prisma.staffTwoFactor.findUnique({ where: { userId: user.id } });
    const enrolled = Boolean(record?.confirmedAt);
    return {
      enrolled,
      verifiedThisSession: await this.isSessionUnlocked(user.id, user.sessionId),
      backupCodesLeft: enrolled
        ? await this.prisma.staffBackupCode.count({ where: { userId: user.id, usedAt: null } })
        : 0,
      lockedUntil:
        record?.lockedUntil && record.lockedUntil > new Date() ? record.lockedUntil : null,
    };
  }

  /**
   * Start (or restart) setting up an app. Returns the secret once, for the QR code; it is
   * stored encrypted. Refused when an app is already set up: an admin must reset it first.
   */
  async startSetup(user: AuthUser) {
    const keys = this.keyProvider();
    const existing = await this.prisma.staffTwoFactor.findUnique({ where: { userId: user.id } });
    if (existing?.confirmedAt) {
      throw new ConflictException(
        'An authenticator app is already set up. Ask an admin to reset it to set up a new one.',
      );
    }
    const secret = generateSecret();
    const fields = {
      secretEncrypted: encryptValue(secret, keys),
      confirmedAt: null,
      lastUsedStep: null,
      failedAttempts: 0,
      lockedUntil: null,
    };
    await this.prisma.staffTwoFactor.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...fields },
      update: fields,
    });
    return {
      secret,
      otpauthUri: otpauthUri({ secret, issuer: ISSUER, account: user.email }),
    };
  }

  /** Finish setup with a first code from the app. Returns the backup codes, shown only once. */
  async confirm(user: AuthUser, code: string) {
    const sessionId = this.requireSession(user);
    const record = await this.prisma.staffTwoFactor.findUnique({ where: { userId: user.id } });
    if (!record) throw new BadRequestException('Start setting up an authenticator app first');
    if (record.confirmedAt) throw new ConflictException('An authenticator app is already set up');
    this.assertNotLocked(record.lockedUntil);

    const step = verifyCode(this.decrypt(record.secretEncrypted), code);
    if (step === null) return this.fail(user.id, record.failedAttempts);

    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, generateBackupCode);
    await this.prisma.$transaction(async (tx) => {
      await tx.staffTwoFactor.update({
        where: { userId: user.id },
        data: { confirmedAt: new Date(), lastUsedStep: step, failedAttempts: 0, lockedUntil: null },
      });
      await tx.staffBackupCode.deleteMany({ where: { userId: user.id } });
      await tx.staffBackupCode.createMany({
        data: backupCodes.map((c) => ({ userId: user.id, codeHash: hashBackupCode(user.id, c) })),
      });
      await this.unlockSession(tx, user.id, sessionId, 'authenticator_app');
      await this.audit.record(
        {
          actorType: 'user',
          actorUserId: user.id,
          action: 'staff_two_factor.enrolled',
          entityType: 'user',
          entityId: user.id,
        },
        tx,
      );
    });
    return { backupCodes };
  }

  /** Unlock this sign-in session with a code from the app, or a backup code. */
  async verify(user: AuthUser, code: string): Promise<{ method: StaffTwoFactorMethod }> {
    const sessionId = this.requireSession(user);
    const record = await this.prisma.staffTwoFactor.findUnique({ where: { userId: user.id } });
    if (!record?.confirmedAt) throw new BadRequestException('Set up an authenticator app first');
    this.assertNotLocked(record.lockedUntil);

    if (looksLikeBackupCode(code)) {
      const used = await this.prisma.$transaction(async (tx) => {
        // Conditional update: two requests racing with the same code can't both succeed.
        const { count } = await tx.staffBackupCode.updateMany({
          where: { userId: user.id, codeHash: hashBackupCode(user.id, code), usedAt: null },
          data: { usedAt: new Date() },
        });
        if (count === 0) return false;
        await tx.staffTwoFactor.update({
          where: { userId: user.id },
          data: { failedAttempts: 0 },
        });
        await this.unlockSession(tx, user.id, sessionId, 'backup_code');
        const left = await tx.staffBackupCode.count({ where: { userId: user.id, usedAt: null } });
        await this.audit.record(
          {
            actorType: 'user',
            actorUserId: user.id,
            action: 'staff_two_factor.backup_code_used',
            entityType: 'user',
            entityId: user.id,
            metadata: { backupCodesLeft: left },
          },
          tx,
        );
        return true;
      });
      if (!used) return this.fail(user.id, record.failedAttempts);
      return { method: 'backup_code' };
    }

    const step = verifyCode(this.decrypt(record.secretEncrypted), code, {
      lastUsedStep: record.lastUsedStep,
    });
    if (step === null) return this.fail(user.id, record.failedAttempts);
    const accepted = await this.prisma.$transaction(async (tx) => {
      // Only move forward: a code already used (here or in a racing request) is refused.
      const { count } = await tx.staffTwoFactor.updateMany({
        where: {
          userId: user.id,
          OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: step } }],
        },
        data: { lastUsedStep: step, failedAttempts: 0 },
      });
      if (count === 0) return false;
      await this.unlockSession(tx, user.id, sessionId, 'authenticator_app');
      return true;
    });
    if (!accepted) return this.fail(user.id, record.failedAttempts);
    return { method: 'authenticator_app' };
  }

  /** New backup codes; the old ones stop working. Only from an unlocked session. */
  async regenerateBackupCodes(user: AuthUser) {
    const record = await this.prisma.staffTwoFactor.findUnique({ where: { userId: user.id } });
    if (!record?.confirmedAt) throw new BadRequestException('Set up an authenticator app first');
    if (!(await this.isSessionUnlocked(user.id, user.sessionId))) {
      throw new BadRequestException('Enter a code from your authenticator app first');
    }
    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, generateBackupCode);
    await this.prisma.$transaction(async (tx) => {
      await tx.staffBackupCode.deleteMany({ where: { userId: user.id } });
      await tx.staffBackupCode.createMany({
        data: backupCodes.map((c) => ({ userId: user.id, codeHash: hashBackupCode(user.id, c) })),
      });
      await this.audit.record(
        {
          actorType: 'user',
          actorUserId: user.id,
          action: 'staff_two_factor.backup_codes_replaced',
          entityType: 'user',
          entityId: user.id,
        },
        tx,
      );
    });
    return { backupCodes };
  }

  /**
   * Remove someone's app, backup codes and unlocked sessions (lost phone). They set up a new
   * app at their next visit to the staff console. Audited.
   */
  async reset(admin: AuthUser, userId: string) {
    const removed = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.staffTwoFactor.deleteMany({ where: { userId } });
      await tx.staffBackupCode.deleteMany({ where: { userId } });
      await tx.staffTwoFactorSession.deleteMany({ where: { userId } });
      if (count > 0) {
        await this.audit.record(
          {
            actorType: 'user',
            actorUserId: admin.id,
            action: 'staff_two_factor.reset',
            entityType: 'user',
            entityId: userId,
          },
          tx,
        );
      }
      return count > 0;
    });
    if (!removed) throw new BadRequestException('This person has no authenticator app set up');
    return { reset: true };
  }

  /** End every unlocked session for someone, e.g. when a staff role is removed. */
  async endSessions(userId: string): Promise<void> {
    await this.prisma.staffTwoFactorSession.deleteMany({ where: { userId } });
  }

  private async unlockSession(
    tx: Pick<PrismaService, 'staffTwoFactorSession'>,
    userId: string,
    sessionId: string,
    method: StaffTwoFactorMethod,
  ) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + UNLOCK_HOURS * 60 * 60 * 1000);
    await tx.staffTwoFactorSession.upsert({
      where: { sessionId },
      create: { sessionId, userId, method, verifiedAt: now, expiresAt },
      // A session id belongs to one user; never let another user's check unlock it.
      update: { userId, method, verifiedAt: now, expiresAt },
    });
  }

  /** Count a wrong code; lock after too many in a row. Always throws. */
  private async fail(userId: string, failedBefore: number): Promise<never> {
    const failed = failedBefore + 1;
    if (failed >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      await this.prisma.staffTwoFactor.update({
        where: { userId },
        data: { failedAttempts: 0, lockedUntil },
      });
      await this.audit.record({
        actorType: 'user',
        actorUserId: userId,
        action: 'staff_two_factor.locked',
        entityType: 'user',
        entityId: userId,
        metadata: { minutes: LOCK_MINUTES },
      });
      this.throwLocked(lockedUntil);
    }
    await this.prisma.staffTwoFactor.update({
      where: { userId },
      data: { failedAttempts: { increment: 1 } },
    });
    throw new BadRequestException(
      'That code is not right. Codes change every 30 seconds; check the time on your phone is correct.',
    );
  }

  private assertNotLocked(lockedUntil: Date | null) {
    if (lockedUntil && lockedUntil > new Date()) this.throwLocked(lockedUntil);
  }

  private throwLocked(lockedUntil: Date): never {
    const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000));
    throw new HttpException(
      `Too many wrong codes. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private requireSession(user: AuthUser): string {
    if (!user.sessionId) throw new BadRequestException('Sign in again, then enter the code');
    return user.sessionId;
  }

  private decrypt(stored: string): string {
    return decryptValue(stored, this.keyProvider());
  }

  private keyProvider(): KeyProvider {
    if (!this.config.DATA_ENCRYPTION_KEYS) {
      throw new ServiceUnavailableException(
        'Data encryption is not configured: set DATA_ENCRYPTION_KEYS (pnpm keys:generate)',
      );
    }
    this.keys ??= new LocalKeyProvider(this.config.DATA_ENCRYPTION_KEYS);
    return this.keys;
  }
}
