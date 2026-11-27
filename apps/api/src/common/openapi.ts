import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { z } from 'zod';

/** OpenAPI schema object, as accepted by `@ApiBody({ schema })` (not exported by @nestjs/swagger). */
type SchemaObject = Extract<
  NonNullable<Parameters<typeof ApiBody>[0]>,
  { schema: unknown }
>['schema'] & {
  properties?: Record<string, unknown>;
  required?: string[];
};

/** Convert a zod schema to an OpenAPI schema object for documentation. */
export function toOpenApiSchema(schema: z.ZodType): SchemaObject {
  // BigInt money values have no JSON Schema equivalent; document them as unconstrained.
  const { $schema: _ignored, ...json } = z.toJSONSchema(schema, {
    unrepresentable: 'any',
    io: 'input',
  });
  return json as SchemaObject;
}

/** Document a zod-validated request body in the OpenAPI spec. */
export const ApiZodBody = (schema: z.ZodType) => ApiBody({ schema: toOpenApiSchema(schema) });

/** Document each property of a zod object schema as a query parameter. */
export function ApiZodQuery(schema: z.ZodObject): MethodDecorator {
  const json = toOpenApiSchema(schema);
  const required = new Set(json.required ?? []);
  const decorators = Object.entries(json.properties ?? {}).map(([name, property]) =>
    ApiQuery({ name, required: required.has(name), schema: property as SchemaObject }),
  );
  return (target, key, descriptor) => {
    for (const decorate of decorators) decorate(target, key, descriptor);
  };
}
