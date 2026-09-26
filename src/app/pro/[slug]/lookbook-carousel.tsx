"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CaretLeft, Export } from "@phosphor-icons/react";
import { GlamImage } from "@/components/glam-image";

interface Look {
  id: string;
  url: string;
  caption: string | null;
}

/**
 * The storefront's photos. On a phone: full width, one at a time, with a
 * "1 / 3" counter and Back and Share over the photo. From tablet width up:
 * the three side by side.
 */
export function LookbookCarousel({
  looks,
  providerName,
  backHref,
}: {
  looks: Look[];
  providerName: string;
  /** Where Back goes when there is no page to go back to. */
  backHref: string;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);

  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push(backHref);
  };

  const share = async () => {
    const url = window.location.href.split("?")[0];
    if (navigator.share) {
      await navigator.share({ url, title: `${providerName} on GLAMNET` }).catch(() => undefined);
    } else {
      await navigator.clipboard?.writeText(url).catch(() => undefined);
    }
  };

  const overlayButton =
    "flex h-11 w-11 items-center justify-center rounded-full bg-surface/90 text-ink shadow-card backdrop-blur";

  return (
    <section aria-label="Lookbook" className="relative -mx-4 -mt-6 sm:mx-0 sm:mt-0">
      <div
        className="rail flex snap-x snap-mandatory overflow-x-auto sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible"
        onScroll={(event) => {
          const row = event.currentTarget;
          setIndex(Math.round(row.scrollLeft / Math.max(1, row.clientWidth)));
        }}
      >
        {looks.map((image, position) => (
          <figure
            key={image.id}
            className="relative aspect-[4/5] w-full shrink-0 snap-center overflow-hidden sm:rounded-glam-lg sm:shadow-card"
          >
            <GlamImage
              src={image.url}
              alt={image.caption || `Look ${position + 1} by ${providerName}`}
              width={800}
              height={1000}
              sizes="(max-width: 640px) 100vw, 33vw"
              priority={position === 0}
              className="h-full w-full object-cover"
            />
            {image.caption ? (
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-obsidian/80 to-transparent p-3 pb-10 text-sm text-on-obsidian sm:pb-3">
                {image.caption}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>

      <div className="absolute inset-x-3 top-3 flex justify-between sm:hidden">
        <button type="button" onClick={back} aria-label="Back" className={overlayButton}>
          <CaretLeft size={20} weight="bold" aria-hidden />
        </button>
        <button type="button" onClick={share} aria-label="Share" className={overlayButton}>
          <Export size={19} weight="bold" aria-hidden />
        </button>
      </div>

      {looks.length > 1 ? (
        <span
          data-numeric
          aria-live="polite"
          className="absolute bottom-3 right-3 rounded-full bg-obsidian/75 px-2.5 py-1 text-xs font-bold text-on-obsidian sm:hidden"
        >
          {Math.min(index + 1, looks.length)} / {looks.length}
        </span>
      ) : null}
    </section>
  );
}
