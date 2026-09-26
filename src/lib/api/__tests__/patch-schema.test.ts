import { describe, expect, it } from "vitest";
import { z } from "zod";
import { patchSchema } from "../patch-schema";

const create = z.object({
  name: z.string().min(2),
  description: z.string().default(""),
  kind: z.enum(["SERVICE", "ADDON"]).default("SERVICE"),
  isActive: z.boolean().default(true),
});

describe("patchSchema", () => {
  it("returns only the fields the request named", () => {
    expect(patchSchema(create).parse({ isActive: false })).toEqual({ isActive: false });
  });

  it("still validates the fields it is given", () => {
    expect(() => patchSchema(create).parse({ name: "x" })).toThrow();
    expect(() => patchSchema(create).parse({ kind: "OTHER" })).toThrow();
  });

  it("leaves the create schema's defaults alone", () => {
    expect(create.parse({ name: "Gel" })).toEqual({ name: "Gel", description: "", kind: "SERVICE", isActive: true });
  });
});
