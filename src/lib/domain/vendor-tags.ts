/**
 * The facts a customer scans for before booking.
 *
 * Two kinds of thing live here, and keeping them apart matters:
 *
 *  - **Amenities** are claims only the vendor can make — a female-only space,
 *    kids welcome, parking. They are stored, they are theirs to set, and they
 *    are what a customer filters on.
 *  - **Derived** tags are read off fields the vendor already fills in
 *    elsewhere (workspace type, whether they travel). They are never stored a
 *    second time: a duplicate would be one more thing to drift out of step
 *    with the field it copies.
 *
 * "Card payments" is deliberately not here. Every booking is card-held through
 * Stripe, so it is a fact about GLAMNET rather than about a vendor, and a tag
 * every single vendor carries tells a customer nothing.
 */

export const VENDOR_AMENITIES = [
  { value: "FEMALE_ONLY", label: "Female-only space" },
  { value: "KIDS_WELCOME", label: "Kids welcome" },
  { value: "BRIDAL_PARTIES", label: "Bridal parties" },
  { value: "BRINGS_OWN_KIT", label: "Brings own kit" },
  { value: "STEP_FREE", label: "Step-free access" },
  { value: "PARKING", label: "Parking available" },
  { value: "NEAR_TRANSPORT", label: "Near public transport" },
] as const;

export type VendorAmenity = (typeof VENDOR_AMENITIES)[number]["value"];

const BY_VALUE = new Map(VENDOR_AMENITIES.map((tag) => [tag.value, tag.label]));

/** Whether a string is one of the amenities we actually recognise. */
export function isVendorAmenity(value: string): value is VendorAmenity {
  return BY_VALUE.has(value as VendorAmenity);
}

/**
 * Clean a list arriving from a form or an API body.
 *
 * Unknown values are dropped rather than rejected: the column is a plain
 * string array, so a stale client or an older row can hold something this
 * build has since renamed, and refusing the whole save over one dead tag
 * would lock a vendor out of editing their own profile. Duplicates collapse,
 * and the catalogue's own order is imposed so two vendors with the same tags
 * always render them the same way round.
 */
export function normaliseAmenities(values: readonly string[]): VendorAmenity[] {
  const wanted = new Set(values.filter(isVendorAmenity));
  return VENDOR_AMENITIES.map((tag) => tag.value).filter((value) =>
    wanted.has(value),
  );
}

export function amenityLabel(value: string): string {
  return BY_VALUE.get(value as VendorAmenity) ?? value;
}

export interface VendorTag {
  label: string;
  /** Derived tags cannot be filtered on — they are not stored as amenities. */
  derived: boolean;
}

/**
 * Everything to show on a storefront, derived tags first.
 *
 * Where the vendor works and whether they come to you are the two questions
 * asked most often, so they lead — which is also GLAMNET's point of
 * difference from a salon directory, where the address is the whole model.
 */
export function vendorTags(input: {
  workspaceType: string;
  travelsToClients: boolean;
  amenities: readonly string[];
}): VendorTag[] {
  const tags: VendorTag[] = [];

  if (input.workspaceType !== "MOBILE") {
    tags.push({ label: workspaceTag(input.workspaceType), derived: true });
  }

  // A mobile vendor travels by definition, so saying both would be noise.
  if (input.travelsToClients || input.workspaceType === "MOBILE") {
    tags.push({ label: "Travels to you", derived: true });
  }

  for (const amenity of normaliseAmenities(input.amenities)) {
    tags.push({ label: amenityLabel(amenity), derived: false });
  }

  return tags;
}

function workspaceTag(workspaceType: string): string {
  switch (workspaceType) {
    case "HOME_SALON":
      return "Home studio";
    case "PRIVATE_ROOM":
      return "Private room";
    case "CHAIR":
      return "Salon chair";
    default:
      return "Studio";
  }
}
