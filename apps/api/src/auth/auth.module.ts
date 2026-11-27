import { type DynamicModule, Global, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/config.js';
import { AUTH_PROVIDER, type AuthProviderGateway, ClerkGateway } from './clerk.gateway.js';
import { AuthGuard, HouseholdAccessGuard, StaffGuard } from './guards.js';
import { IdentityService } from './identity.service.js';
import { MeController } from './me.controller.js';
import { StaffController } from './staff.controller.js';
import {
  StaffTwoFactorAdminController,
  StaffTwoFactorController,
} from '../staff-two-factor/staff-two-factor.controller.js';
import { StaffTwoFactorService } from '../staff-two-factor/staff-two-factor.service.js';
import { ClerkTokenVerifier, TOKEN_VERIFIER } from './token-verifier.js';
import { UnconfiguredGateway } from './unconfigured.gateway.js';

export interface AuthModuleOptions {
  /** Replace the auth provider (tests use a fake instead of Clerk). */
  provider?: AuthProviderGateway;
}

@Global()
@Module({})
export class AuthModule {
  static register(options: AuthModuleOptions = {}): DynamicModule {
    return {
      module: AuthModule,
      controllers: [
        MeController,
        StaffController,
        StaffTwoFactorController,
        StaffTwoFactorAdminController,
      ],
      providers: [
        options.provider
          ? { provide: AUTH_PROVIDER, useValue: options.provider }
          : {
              provide: AUTH_PROVIDER,
              inject: [APP_CONFIG],
              useFactory: (config: AppConfig) =>
                config.CLERK_SECRET_KEY
                  ? new ClerkGateway(config.CLERK_SECRET_KEY)
                  : new UnconfiguredGateway(),
            },
        {
          provide: TOKEN_VERIFIER,
          inject: [APP_CONFIG],
          useFactory: (config: AppConfig) =>
            new ClerkTokenVerifier({
              secretKey: config.CLERK_SECRET_KEY,
              jwtKey: config.CLERK_JWT_KEY,
              authorizedParties: config.AUTH_AUTHORIZED_PARTIES,
            }),
        },
        StaffTwoFactorService,
        StaffTwoFactorService,
        IdentityService,
        AuthGuard,
        StaffGuard,
        HouseholdAccessGuard,
      ],
      exports: [
        AUTH_PROVIDER,
        TOKEN_VERIFIER,
        IdentityService,
        AuthGuard,
        StaffGuard,
        HouseholdAccessGuard,
      ],
    };
  }
}
