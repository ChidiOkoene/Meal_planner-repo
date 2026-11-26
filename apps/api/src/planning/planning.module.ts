import { Module } from '@nestjs/common';
import { CatalogueModule } from '../catalogue/catalogue.module.js';
import { DevelopmentOnlyGuard } from './development-only.guard.js';
import { PlanningController } from './planning.controller.js';
import { PlanningService } from './planning.service.js';

@Module({
  imports: [CatalogueModule],
  controllers: [PlanningController],
  providers: [PlanningService, DevelopmentOnlyGuard],
})
export class PlanningModule {}
