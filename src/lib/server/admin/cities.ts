import { z } from "zod";
import { patchSchema } from "@/lib/api/patch-schema";
import { prisma } from "../prisma";
import { deleteImageKitFiles } from "../imagekit-admin";
import { lookupPlace } from "../geo";
import { citySlug } from "@/lib/domain/postcode";
import { isTrustedImageUrl } from "@/lib/imagekit";
import { AdminError, audit } from "./core";

/**
 * The cities under "Browse by city".
 *
 * An admin gives a postcode (or outward code) in the city centre; the city's
 * name is taken from that postcode, never typed. Vendors are counted by the
 * city their own postcode resolves to, so a hand-typed name that differed by
 * a word ("Newcastle" vs "Newcastle upon Tyne") would sit at 0 pros forever.
 * The tile can still show a friendlier label.
 */
export const cityInput = z.object({
  postcode: z.string().trim().min(2).max(10),
  label: z.string().trim().max(60).default(""),
  imageUrl: z.string().trim().max(500).default(""),
  imageFileId: z.string().trim().max(200).default(""),
  sortOrder: z.number().int().min(0).max(10_000).default(100),
  isActive: z.boolean().default(true),
});

async function placeFor(postcode: string) {
  const place = await lookupPlace(postcode);
  if (!place) throw new AdminError("We couldn't find that postcode. Try the city centre's, e.g. M2 or LS1 4DY.", 422);
  const slug = citySlug(place.city);
  if (!slug || place.city === "United Kingdom") {
    throw new AdminError("That postcode doesn't belong to a named city or town.", 422);
  }
  return { name: place.city, slug, outcode: place.outcode, latitude: place.lat, longitude: place.lng };
}

function checkImage(url: string | undefined) {
  // Our own library only: this URL is rendered on the home page for everyone.
  if (url && !isTrustedImageUrl(url) && !url.startsWith("https://ik.imagekit.io/glamnetapp/")) {
    throw new AdminError("Upload the photo here rather than pasting a link.", 422);
  }
}

export async function createCity(actorEmail: string, raw: unknown) {
  const { postcode, ...input } = cityInput.parse(raw);
  checkImage(input.imageUrl);
  const place = await placeFor(postcode);
  const clash = await prisma.city.findFirst({ where: { OR: [{ slug: place.slug }, { name: place.name }] } });
  if (clash) throw new AdminError(`${place.name} is already on the list.`);
  const city = await prisma.city.create({ data: { ...input, ...place } });
  await audit(actorEmail, "city.create", { type: "City", id: city.id }, city.name);
  return city;
}

export async function updateCity(actorEmail: string, id: string, raw: unknown) {
  const { postcode, ...input } = patchSchema(cityInput).parse(raw);
  checkImage(input.imageUrl);
  const current = await prisma.city.findUnique({ where: { id } });
  if (!current) throw new AdminError("That city is no longer on the list.", 404, "NOT_FOUND");

  const place = postcode && postcode.toUpperCase() !== current.outcode ? await placeFor(postcode) : null;
  if (place && place.name !== current.name) {
    const clash = await prisma.city.findFirst({
      where: { id: { not: id }, OR: [{ slug: place.slug }, { name: place.name }] },
    });
    if (clash) throw new AdminError(`${place.name} is already on the list.`);
  }

  const city = await prisma.city.update({ where: { id }, data: { ...input, ...(place ?? {}) } });
  if (input.imageFileId !== undefined && current.imageFileId && current.imageFileId !== input.imageFileId) {
    await deleteImageKitFiles([current.imageFileId]);
  }
  await audit(
    actorEmail,
    "city.update",
    { type: "City", id },
    place && place.name !== current.name ? `${current.name} → ${city.name}` : city.name,
  );
  return city;
}

export async function deleteCity(actorEmail: string, id: string) {
  const current = await prisma.city.findUnique({ where: { id } });
  if (!current) throw new AdminError("That city is no longer on the list.", 404, "NOT_FOUND");
  // Only the listing goes. Vendors and their areas are untouched, and a city
  // with live pros comes back on the rail by itself (without a photo).
  await prisma.city.delete({ where: { id } });
  if (current.imageFileId) await deleteImageKitFiles([current.imageFileId]);
  await audit(actorEmail, "city.delete", { type: "City", id }, current.name);
}
