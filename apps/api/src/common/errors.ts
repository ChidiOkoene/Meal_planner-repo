import { BadRequestException } from '@nestjs/common';

export interface FieldProblem {
  path: string;
  message: string;
}

/** Thrown by the zod validation pipe; rendered as a 400 with field-level details. */
export class ValidationFailedException extends BadRequestException {
  constructor(readonly details: FieldProblem[]) {
    super('Request validation failed');
  }
}
