import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StaffOnly } from '../auth/decorators.js';
import {
  type DishListQuery,
  dishListQuerySchema,
  type IdParam,
  idParamSchema,
} from '@dyjext/shared';
import { ApiZodQuery } from '../common/openapi.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CatalogueService } from './catalogue.service.js';

/** Read-only catalogue endpoints for the staff console. Any staff role. */
@ApiTags('catalogue')
@ApiBearerAuth()
@StaffOnly()
@Controller('ops')
export class CatalogueController {
  constructor(@Inject(CatalogueService) private readonly catalogue: CatalogueService) {}

  @Get('dishes')
  @ApiZodQuery(dishListQuerySchema)
  listDishes(@Query(new ZodValidationPipe(dishListQuerySchema)) query: DishListQuery) {
    return this.catalogue.listDishes(query);
  }

  @Get('dishes/:id')
  getDish(@Param(new ZodValidationPipe(idParamSchema)) { id }: IdParam) {
    return this.catalogue.getDish(id);
  }

  @Get('ingredients')
  listIngredients() {
    return this.catalogue.listIngredients();
  }

  @Get('units')
  listUnits() {
    return this.catalogue.listUnits();
  }
}
