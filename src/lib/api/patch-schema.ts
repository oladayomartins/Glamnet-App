import { z } from "zod";

/**
 * The update (PATCH) version of a create schema: every field optional, and
 * no defaults.
 *
 * Not `schema.partial()`. In Zod 4 a partial schema still fills in defaults
 * for fields the request didn't mention, so `{ isActive: false }` came back
 * as `{ isActive: false, description: "", kind: "SERVICE", ... }` and the
 * update quietly reset everything it didn't name.
 */
export function patchSchema<Shape extends z.ZodRawShape>(schema: z.ZodObject<Shape>) {
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => [
      key,
      field instanceof z.ZodDefault ? (field.unwrap() as z.ZodType) : field,
    ]),
  );
  return z.object(shape).partial() as unknown as ReturnType<z.ZodObject<Shape>["partial"]>;
}
