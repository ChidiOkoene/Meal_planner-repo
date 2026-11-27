import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type CreateHousehold,
  createHouseholdSchema,
  type CreateRecipient,
  createRecipientSchema,
  householdRecipientParamsSchema,
  type IdParam,
  idParamSchema,
  type PaginationQuery,
  paginationQuerySchema,
  recipientStatusChangeSchema,
} from '@dyjext/shared';
import { type z } from 'zod';
import { type AuthUser } from '../auth/auth-user.js';
import { CurrentUser, HouseholdAccess } from '../auth/decorators.js';
import { ApiZodBody, ApiZodQuery } from '../common/openapi.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { HouseholdsService } from './households.service.js';

/**
 * Households and their recipients. Members (and ops staff, for support) can read; only the
 * household owner can change anything.
 */
@ApiTags('households')
@ApiBearerAuth()
@Controller('households')
export class HouseholdsController {
  constructor(@Inject(HouseholdsService) private readonly households: HouseholdsService) {}

  @Post()
  @ApiZodBody(createHouseholdSchema)
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createHouseholdSchema)) body: CreateHousehold,
  ) {
    return this.households.create(user, body);
  }

  @Get()
  listMine(@CurrentUser() user: AuthUser) {
    return this.households.listMine(user);
  }

  @Get(':id')
  @HouseholdAccess('id')
  get(@Param(new ZodValidationPipe(idParamSchema)) { id }: IdParam) {
    return this.households.get(id);
  }

  @Get(':id/recipients')
  @HouseholdAccess('id')
  listRecipients(@Param(new ZodValidationPipe(idParamSchema)) { id }: IdParam) {
    return this.households.listRecipients(id);
  }

  /** Add a parent, relative or friend, or yourself. They get a consent request on WhatsApp. */
  @Post(':id/recipients')
  @HouseholdAccess('id')
  @ApiZodBody(createRecipientSchema)
  addRecipient(
    @CurrentUser() user: AuthUser,
    @Param(new ZodValidationPipe(idParamSchema)) { id }: IdParam,
    @Body(new ZodValidationPipe(createRecipientSchema)) body: CreateRecipient,
  ) {
    return this.households.addRecipient(user, id, body);
  }

  /** Pause, resume or close a recipient's service. */
  @Post(':id/recipients/:recipientId/status')
  @HttpCode(200)
  @HouseholdAccess('id')
  @ApiZodBody(recipientStatusChangeSchema)
  changeStatus(
    @CurrentUser() user: AuthUser,
    @Param(new ZodValidationPipe(householdRecipientParamsSchema))
    params: z.infer<typeof householdRecipientParamsSchema>,
    @Body(new ZodValidationPipe(recipientStatusChangeSchema))
    body: z.infer<typeof recipientStatusChangeSchema>,
  ) {
    return this.households.changeStatus(user, params.id, params.recipientId, body.status);
  }

  @Get(':id/timeline')
  @HouseholdAccess('id')
  @ApiZodQuery(paginationQuerySchema)
  timeline(
    @Param(new ZodValidationPipe(idParamSchema)) { id }: IdParam,
    @Query(new ZodValidationPipe(paginationQuerySchema)) page: PaginationQuery,
  ) {
    return this.households.timeline(id, page);
  }
}
