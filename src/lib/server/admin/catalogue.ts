import { z } from "zod";
import { prisma } from "../prisma";
import { deleteImageKitFiles } from "../imagekit-admin";
import { slugify } from "@/lib/domain/storefront";
import { AdminError, audit } from "./core";

/**
 * Categories (Specialty Hubs) and the service catalogue.
 *
 * A service stores its category by name, so a rename is applied to every
 * service in the same transaction — otherwise a renamed hub would silently
 * lose all its services from the directory.
 */

export const categoryInput = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().max(60).optional(),
  emoji: z.string().trim().max(16).default(""),
  blurb: z.string().trim().max(160).default(""),
  imageUrl: z.string().trim().max(500).default(""),
  imageFileId: z.string().trim().max(200).default(""),
  sortOrder: z.number().int().min(0).max(10_000).default(100),
  isActive: z.boolean().default(true),
});

export async function createCategory(actorEmail: string, raw: unknown) {
  const input = categoryInput.parse(raw);
  const slug = slugify(input.slug || input.name);
  if (!slug) throw new AdminError("Give the category a name with letters in it.", 422);
  const clash = await prisma.category.findFirst({
    where: { OR: [{ slug }, { name: input.name }] },
  });
  if (clash) throw new AdminError("A category with that name or link already exists.");
  const category = await prisma.category.create({ data: { ...input, slug } });
  await audit(actorEmail, "category.create", { type: "Category", id: category.id }, category.name);
  return category;
}

export async function updateCategory(actorEmail: string, id: string, raw: unknown) {
  const input = categoryInput.partial().parse(raw);
  const current = await prisma.category.findUnique({ where: { id } });
  if (!current) throw new AdminError("That category no longer exists.", 404, "NOT_FOUND");

  const slug = input.slug !== undefined ? slugify(input.slug || current.name) : undefined;
  const renamed = input.name !== undefined && input.name !== current.name;
  if (renamed || (slug && slug !== current.slug)) {
    const clash = await prisma.category.findFirst({
      where: {
        id: { not: id },
        OR: [...(renamed ? [{ name: input.name }] : []), ...(slug ? [{ slug }] : [])],
      },
    });
    if (clash) throw new AdminError("Another category already uses that name or link.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (renamed) {
      await tx.service.updateMany({
        where: { category: current.name },
        data: { category: input.name! },
      });
    }
    return tx.category.update({ where: { id }, data: { ...input, ...(slug ? { slug } : {}) } });
  });

  if (input.imageFileId !== undefined && current.imageFileId && current.imageFileId !== input.imageFileId) {
    await deleteImageKitFiles([current.imageFileId]);
  }
  await audit(
    actorEmail,
    "category.update",
    { type: "Category", id },
    renamed ? `${current.name} → ${updated.name}` : updated.name,
  );
  return updated;
}

export async function deleteCategory(actorEmail: string, id: string) {
  const current = await prisma.category.findUnique({ where: { id } });
  if (!current) throw new AdminError("That category no longer exists.", 404, "NOT_FOUND");
  const inUse = await prisma.service.count({ where: { category: current.name } });
  if (inUse > 0) {
    throw new AdminError(
      `${inUse} service${inUse === 1 ? " is" : "s are"} still in this category. Move them or hide the category instead.`,
    );
  }
  await prisma.category.delete({ where: { id } });
  if (current.imageFileId) await deleteImageKitFiles([current.imageFileId]);
  await audit(actorEmail, "category.delete", { type: "Category", id }, current.name);
}

export const serviceInput = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).default(""),
  category: z.string().trim().min(1),
  kind: z.enum(["SERVICE", "ADDON"]).default("SERVICE"),
  priceMinor: z.number().int().min(0).max(1_000_000),
  durationMinutes: z.number().int().min(5).max(24 * 60),
  isActive: z.boolean().default(true),
});

async function assertCategory(name: string) {
  const exists = await prisma.category.findUnique({ where: { name } });
  if (!exists) throw new AdminError("Pick one of the categories in the list.", 422);
}

export async function createService(actorEmail: string, raw: unknown) {
  const input = serviceInput.parse(raw);
  await assertCategory(input.category);
  const service = await prisma.service.create({ data: input });
  await audit(actorEmail, "service.create", { type: "Service", id: service.id }, `${service.name} (${service.category})`);
  return service;
}

export async function updateService(actorEmail: string, id: string, raw: unknown) {
  const input = serviceInput.partial().parse(raw);
  if (input.category) await assertCategory(input.category);
  const exists = await prisma.service.findUnique({ where: { id } });
  if (!exists) throw new AdminError("That service no longer exists.", 404, "NOT_FOUND");
  // Services are never hard-deleted: past bookings point at them. Hiding one
  // (isActive false) takes it off every menu and search.
  const service = await prisma.service.update({ where: { id }, data: input });
  await audit(actorEmail, "service.update", { type: "Service", id }, service.name);
  return service;
}
