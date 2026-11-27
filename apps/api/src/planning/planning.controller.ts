import { Body, Controller, Get, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type PlannerPreviewRequest, plannerPreviewRequestSchema } from '@dyjext/shared';
import { ApiZodBody } from '../common/openapi.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { DevelopmentOnlyGuard } from './development-only.guard.js';
import { PlanningService } from './planning.service.js';

/**
 * Development-only planner preview (issue #48). Uses sample data and illustrative limits;
 * hidden in production. Like every /v1/ops route, it needs authentication from issue #8.
 */
@ApiTags('planner preview (development only)')
@UseGuards(DevelopmentOnlyGuard)
@Controller('ops/planner')
export class PlanningController {
  constructor(@Inject(PlanningService) private readonly planning: PlanningService) {}

  @Get('presets')
  presets() {
    return this.planning.listPresets();
  }

  @Post('preview')
  @HttpCode(200)
  @ApiZodBody(plannerPreviewRequestSchema)
  preview(@Body(new ZodValidationPipe(plannerPreviewRequestSchema)) body: PlannerPreviewRequest) {
    return this.planning.preview(body);
  }
}
