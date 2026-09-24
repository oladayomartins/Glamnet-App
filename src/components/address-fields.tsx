"use client";

import { PostcodeField, type ResolvedPlace } from "./postcode-field";
import { distanceKm, formatMiles } from "@/lib/domain/postcode";

export interface AddressValue {
  street: string;
  postcode: string;
  place: ResolvedPlace | null;
}

export const EMPTY_ADDRESS: AddressValue = { street: "", postcode: "", place: null };

/** Ready to book: a street line and a real, full postcode. */
export function addressComplete(value: AddressValue): boolean {
  return value.street.trim().length >= 3 && Boolean(value.place?.postcode);
}

/** "12 Oak Road, Sheffield S10 2HN" — the one line stored on the booking. */
export function formatAddress(value: AddressValue): string {
  if (!addressComplete(value)) return "";
  return `${value.street.trim()}, ${value.place!.city} ${value.place!.postcode}`;
}

/**
 * Where the pro should come to: postcode first (with suggestions and "Use my
 * location"), then the house number and street. The postcode is checked
 * against the UK postcode list before the booking can be placed.
 */
export function AddressFields({
  value,
  onChange,
  from,
}: {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  /** The pro's area, to say roughly how far they travel. */
  from?: { lat: number; lng: number; name: string } | null;
}) {
  const miles =
    from && value.place ? formatMiles(distanceKm(from, { lat: value.place.lat, lng: value.place.lng })) : null;

  return (
    <div className="space-y-3">
      <PostcodeField
        label="Your postcode"
        value={value.postcode}
        onChange={(postcode) => onChange({ ...value, postcode, place: value.postcode === postcode ? value.place : null })}
        onResolved={(place) => onChange({ ...value, postcode: place?.postcode ?? value.postcode, place })}
        hint="The pro only sees your address once they are confirmed."
      />
      {miles ? (
        <p className="-mt-2 text-xs text-ink-muted">
          About {miles} from {from!.name}&rsquo;s area.
        </p>
      ) : null}
      <label className="block">
        <span className="text-sm font-medium text-ink">House number and street</span>
        <input
          value={value.street}
          onChange={(event) => onChange({ ...value, street: event.target.value })}
          autoComplete="address-line1"
          placeholder="e.g. Flat 2, 14 Oak Road"
          className="mt-1 min-h-11 w-full rounded-glam-input border border-line bg-surface px-3 text-[15px] text-ink outline-none focus:border-accent-500"
        />
      </label>
    </div>
  );
}
