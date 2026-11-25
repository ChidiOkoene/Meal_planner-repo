import { type PipeTransform } from '@nestjs/common';
import { type z } from 'zod';
import { ValidationFailedException } from './errors.js';

/**
 * Validates and parses a request part (body, query, params) with a zod schema.
 * Returns the parsed value, so defaults and coercions are applied.
 *
 * Usage: `@Body(new ZodValidationPipe(createThingSchema)) body: CreateThing`
 */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new ValidationFailedException(
        result.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      );
    }
    return result.data;
  }
}
