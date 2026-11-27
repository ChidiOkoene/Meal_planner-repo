import { type CanActivate, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/config.js';

/** Hides a route entirely in production (404, not 403, so it isn't discoverable). */
@Injectable()
export class DevelopmentOnlyGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(): boolean {
    if (this.config.NODE_ENV === 'production') throw new NotFoundException();
    return true;
  }
}
