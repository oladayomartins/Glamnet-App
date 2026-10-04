import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getStorefrontCard } from "@/lib/server/storefront";
import { isTrustedImageUrl } from "@/lib/imagekit";

/**
 * A storefront's link preview: the vendor's own best work, not the generic
 * GLAMNET card. This is what shows when a vendor pastes their bio link into
 * Instagram, WhatsApp or iMessage, so it leads with the first lookbook photo
 * (else their avatar) and names them over a dark band with the lockup.
 *
 * A vendor with no photo yet gets the obsidian-and-gold card with their name.
 * Fonts are bundled in assets/fonts rather than fetched, so a slow font host
 * can never fail the preview.
 */
export const alt = "Work by a verified GLAMNET pro";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const [display, body, logo] = await Promise.all([
  readFile(join(process.cwd(), "assets/fonts/BricolageGrotesque-ExtraBold.ttf")),
  readFile(join(process.cwd(), "assets/fonts/InstrumentSans-Medium.ttf")),
  readFile(join(process.cwd(), "public/brand/glamnet-logo.png"), "base64"),
]);
const logoSrc = `data:image/png;base64,${logo}`;

const OBSIDIAN = "#121212";
const GOLD = "#D9B061";
const INK = "#F4EEE2";
const INK_MUTED = "#C9C2B6";

/**
 * The photo as a data URI, cropped by ImageKit to the card and served as JPEG
 * (the renderer cannot read WebP). Null when there is none, it is not from
 * our own media library, or it cannot be fetched in time.
 */
async function photoDataUri(url: string | null): Promise<string | null> {
  if (!url || !isTrustedImageUrl(url)) return null;
  const sized = new URL(url);
  sized.searchParams.set("tr", `w-${size.width},h-${size.height},fo-auto,f-jpg`);
  try {
    const response = await fetch(sized, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:image/jpeg;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = await getStorefrontCard(slug);
  const photo = await photoDataUri(card?.photoUrl ?? null);
  const name = card?.name ?? "GLAMNET";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: OBSIDIAN,
          fontFamily: "Instrument Sans",
        }}
      >
        {photo ? (
          <img
            src={photo}
            alt=""
            width={size.width}
            height={size.height}
            style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              // Explicit box: the renderer ignores `inset` on a div.
              position: "absolute",
              top: 24,
              left: 24,
              width: size.width - 48,
              height: size.height - 48,
              display: "flex",
              backgroundImage: "linear-gradient(to bottom, rgba(217,176,97,0.34), rgba(18,18,18,0) 75%)",
              border: `2px solid ${GOLD}`,
              borderRadius: 28,
            }}
          />
        )}

        {/* The band the name sits on: dark enough to read over any photo. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 300,
            display: "flex",
            backgroundImage: `linear-gradient(to bottom, rgba(18,18,18,0), rgba(18,18,18,0.92) 55%)`,
          }}
        />

        <div
          style={{
            position: "absolute",
            left: 56,
            right: 56,
            bottom: 48,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
            <div
              style={{
                fontFamily: "Bricolage Grotesque",
                fontSize: name.length > 22 ? 56 : 68,
                lineHeight: 1.05,
                letterSpacing: -1.5,
                color: INK,
              }}
            >
              {name}
            </div>
            {card ? (
              <div style={{ marginTop: 14, fontSize: 30, color: INK_MUTED }}>{card.place}</div>
            ) : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <img src={logoSrc} alt="" width={240} height={43} />
            <div style={{ marginTop: 10, fontSize: 22, color: GOLD }}>Book on GLAMNET</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Bricolage Grotesque", data: display, weight: 800, style: "normal" },
        { name: "Instrument Sans", data: body, weight: 500, style: "normal" },
      ],
    },
  );
}
