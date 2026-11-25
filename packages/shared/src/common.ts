import { z } from 'zod';

/** A UUID primary key (all ids in the system are UUIDv7). */
export const idSchema = z.uuid();

/** Route parameter `:id`. */
export const idParamSchema = z.object({ id: idSchema });
export type IdParam = z.infer<typeof idParamSchema>;

/** ISO 4217 currency code, e.g. "GBP", "NGN". */
export const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Must be a 3-letter ISO currency code, e.g. GBP');

/** Money as an integer number of minor units (pence, kobo) plus a currency. Never floats. */
export const moneySchema = z.object({
  amountMinor: z.coerce.bigint(),
  currency: currencySchema,
});
export type Money = z.infer<typeof moneySchema>;

/** Cursor pagination for list endpoints. */
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: idSchema.optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Shape of every error response from the API. */
export const apiErrorSchema = z.object({
  error: z.object({
    /** Stable, machine-readable code, e.g. "validation_failed", "not_found". */
    code: z.string(),
    message: z.string(),
    /** Field-level problems for validation errors. */
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
    requestId: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
