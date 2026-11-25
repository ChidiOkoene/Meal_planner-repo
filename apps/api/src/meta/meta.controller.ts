import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { APP_CONFIG, type AppConfig } from '../config/config.js';

@ApiTags('meta')
@Controller('meta')
export class MetaController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /** Which build is running, for support and debugging. */
  @Get()
  @ApiOkResponse({ description: 'Service name, release version and environment' })
  get() {
    return {
      service: 'dyjext-api',
      version: this.config.APP_VERSION,
      environment: this.config.NODE_ENV,
    };
  }
}
