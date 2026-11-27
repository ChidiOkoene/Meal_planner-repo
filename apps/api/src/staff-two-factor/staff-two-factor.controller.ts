import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type StaffTwoFactorCode,
  staffTwoFactorCodeSchema,
  staffUserParamsSchema,
} from '@dyjext/shared';
import { type z } from 'zod';
import { type AuthUser } from '../auth/auth-user.js';
import { CurrentUser, StaffOnly } from '../auth/decorators.js';
import { ApiZodBody } from '../common/openapi.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { StaffTwoFactorService } from './staff-two-factor.service.js';

/**
 * A staff member's own authenticator app. These routes are how staff unlock the console, so
 * they need a staff role but not an unlocked session.
 */
@ApiTags('staff-two-factor')
@ApiBearerAuth()
@Controller('me/staff-two-factor')
export class StaffTwoFactorController {
  constructor(@Inject(StaffTwoFactorService) private readonly service: StaffTwoFactorService) {}

  @Get()
  status(@CurrentUser() user: AuthUser) {
    requireStaff(user);
    return this.service.status(user);
  }

  /** Begin setup: returns the secret and the link for the QR code. */
  @Post('setup')
  @HttpCode(200)
  setup(@CurrentUser() user: AuthUser) {
    requireStaff(user);
    return this.service.startSetup(user);
  }

  /** Finish setup with a first code; returns backup codes, shown only once. */
  @Post('confirm')
  @HttpCode(200)
  @ApiZodBody(staffTwoFactorCodeSchema)
  confirm(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(staffTwoFactorCodeSchema)) body: StaffTwoFactorCode,
  ) {
    requireStaff(user);
    return this.service.confirm(user, body.code);
  }

  /** Unlock the staff console for this sign-in with an app code or a backup code. */
  @Post('verify')
  @HttpCode(200)
  @ApiZodBody(staffTwoFactorCodeSchema)
  verify(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(staffTwoFactorCodeSchema)) body: StaffTwoFactorCode,
  ) {
    requireStaff(user);
    return this.service.verify(user, body.code);
  }

  /** Replace the backup codes. */
  @Post('backup-codes')
  @HttpCode(200)
  backupCodes(@CurrentUser() user: AuthUser) {
    requireStaff(user);
    return this.service.regenerateBackupCodes(user);
  }
}

/** Admins: reset someone's authenticator app (lost phone). */
@ApiTags('staff')
@ApiBearerAuth()
@StaffOnly('admin')
@Controller('ops/staff')
export class StaffTwoFactorAdminController {
  constructor(@Inject(StaffTwoFactorService) private readonly service: StaffTwoFactorService) {}

  @Delete(':userId/two-factor')
  @HttpCode(200)
  reset(
    @CurrentUser() admin: AuthUser,
    @Param(new ZodValidationPipe(staffUserParamsSchema))
    params: z.infer<typeof staffUserParamsSchema>,
  ) {
    return this.service.reset(admin, params.userId);
  }
}

function requireStaff(user: AuthUser) {
  if (user.staffRoles.length === 0) throw new ForbiddenException('Staff only');
}
