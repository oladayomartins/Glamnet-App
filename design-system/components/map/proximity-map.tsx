import { GlamNetPin } from "@/components/brand/logo";
import { cn } from "@/lib/cn";

/**
 * Map surfaces.
 *
 * These render a stylised basemap using the same tokens the real MapLibre
 * style JSON is built from — obsidian/graphite in dark, warm paper in light,
 * no satellite imagery. Swap `MapCanvas` for the live map in the app; the pin,
 * card and legend components on top of it stay exactly as they are.
 *
 * Rules that hold on every map:
 *   · Customer pin = metal teardrop. Providers = rose gold dots.
 *     Live / en route = jade with a slow pulse.
 *   · Exact addresses only render after Address Unlocked. Before that, show the
 *     sector shape — never a house.
 *   · One pulsing element per map. More than one reads as an alarm.
 */
function MapCanvas({ gridSize }: { gridSize: number }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 bg-[image:linear-gradient(var(--gn-map-grid)_1px,transparent_1px),linear-gradient(90deg,var(--gn-map-grid)_1px,transparent_1px)]"
      style={{ backgroundSize: `${gridSize}px ${gridSize}px` }}
    />
  );
}

interface ProviderCard {
  name: string;
  eta: string;
  /** The closest provider is promoted to metal — one per map. */
  featured?: boolean;
  style: React.CSSProperties;
  animation: string;
}

const providers: ProviderCard[] = [
  {
    name: "Amara",
    eta: "8 min",
    style: { left: "18%", top: "23%" },
    animation: "gn-float 5s ease-in-out infinite",
  },
  {
    name: "Kaya",
    eta: "14 min",
    style: { right: "12%", top: "40%" },
    animation: "gn-float 6.4s ease-in-out 0.6s infinite",
  },
  {
    name: "Nia",
    eta: "5 min",
    featured: true,
    style: { left: "24%", bottom: "15%" },
    animation: "gn-float 5.8s ease-in-out 1.2s infinite",
  },
];

/**
 * Hero map — live providers around a customer pin.
 *
 * @param clock Rendered into the live counter. Pass `null` on the server and
 *   fill it in after mount; a ticking clock in SSR output is a hydration
 *   mismatch waiting to happen.
 */
export function ProximityMap({
  clock,
  className,
}: {
  clock: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative min-h-[400px] overflow-hidden rounded-[22px] border border-line bg-surface-1 shadow-e3",
        className,
      )}
    >
      <MapCanvas gridSize={44} />

      {/* Roads */}
      <div
        aria-hidden="true"
        className="absolute -right-[30%] -left-[30%] h-4 bg-map-road"
        style={{ top: "32%", transform: "rotate(-7deg)" }}
      />
      <div
        aria-hidden="true"
        className="absolute -right-[30%] -left-[30%] h-[22px] bg-map-road"
        style={{ top: "64%", transform: "rotate(4deg)" }}
      />
      <div
        aria-hidden="true"
        className="absolute -top-[20%] -bottom-[20%] w-3.5 bg-map-road"
        style={{ left: "58%", transform: "rotate(11deg)" }}
      />

      {/* Sector shapes — never a house */}
      <div
        aria-hidden="true"
        className="absolute h-[92px] w-[118px] rounded-[14px] bg-live-tint"
        style={{ left: "6%", top: "8%" }}
      />
      <div
        aria-hidden="true"
        className="absolute h-[78px] w-24 rounded-[14px] bg-surface-3"
        style={{ right: "8%", bottom: "10%" }}
      />

      {/* Search sweep + the map's single pulse */}
      <div
        aria-hidden="true"
        className="absolute size-[220px] rounded-full border border-dashed border-rose opacity-35 animate-sweep"
        style={{ left: "47%", top: "46%", margin: "-110px 0 0 -110px" }}
      />
      <div
        aria-hidden="true"
        className="absolute size-[146px] rounded-full bg-rose opacity-[0.14] animate-ring"
        style={{ left: "47%", top: "46%", margin: "-73px 0 0 -73px" }}
      />

      {/* Customer pin */}
      <div
        className="absolute flex flex-col items-center gap-1.5"
        style={{ left: "47%", top: "46%", transform: "translate(-50%,-100%)" }}
      >
        <div className="rounded-pill border border-line bg-surface-3 px-[11px] py-[5px] text-[11px] font-semibold whitespace-nowrap shadow-e2">
          You · Sector S11
        </div>
        <GlamNetPin size={26} />
      </div>

      {/* Nearby providers */}
      {providers.map((provider) => (
        <div
          key={provider.name}
          className={cn(
            "absolute flex items-center gap-[7px] rounded-pill py-[5px] pr-[11px] pl-[5px]",
            provider.featured
              ? "bg-metal text-metal-ink shadow-[0_8px_22px_oklch(0.76_0.085_32_/_0.28)]"
              : "border border-line bg-surface-3 shadow-e2",
          )}
          style={{ ...provider.style, animation: provider.animation }}
        >
          <div
            aria-hidden="true"
            className={cn(
              "size-[23px] rounded-full",
              provider.featured
                ? "bg-[repeating-linear-gradient(45deg,oklch(0.30_0.02_40)_0_4px,oklch(0.22_0.015_40)_4px_8px)]"
                : provider.name === "Amara"
                  ? "bg-[repeating-linear-gradient(45deg,var(--gn-rose)_0_4px,var(--gn-rose-tint)_4px_8px)]"
                  : "bg-[repeating-linear-gradient(45deg,var(--gn-champagne)_0_4px,var(--gn-surface-3)_4px_8px)]",
            )}
          />
          <div
            className={cn(
              "text-[11px]",
              provider.featured ? "font-bold" : "font-semibold",
            )}
          >
            {provider.name} · {provider.eta}
          </div>
        </div>
      ))}

      <div className="absolute bottom-3.5 left-3.5 flex items-center gap-2 rounded-tile border border-line bg-bg px-[11px] py-2 font-mono text-[10px] tracking-[0.06em] uppercase text-text-2">
        <span className="size-1.5 animate-[gn-breathe_2s_ease-in-out_infinite] rounded-full bg-live" />
        12 providers live · {clock ?? "--:--"}
      </div>
      <div className="absolute top-3.5 right-3.5 font-mono text-[10px] tracking-[0.06em] uppercase text-text-3">
        Map / provider proximity
      </div>
    </div>
  );
}

/**
 * Compact sector map — the in-app radius view. Jade centre pulses because the
 * provider is live; the rose dots are static peers.
 */
export function SectorMap({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative h-[190px] overflow-hidden rounded-tile border border-line bg-surface-1",
        className,
      )}
    >
      <MapCanvas gridSize={34} />
      <div
        aria-hidden="true"
        className="absolute -right-[20%] -left-[20%] h-3 bg-map-road"
        style={{ top: "44%", transform: "rotate(-5deg)" }}
      />
      <div
        aria-hidden="true"
        className="absolute size-[104px] rounded-full bg-live opacity-[0.16] animate-ring-slow"
        style={{ left: "50%", top: "50%", margin: "-52px 0 0 -52px" }}
      />
      <div
        aria-hidden="true"
        className="absolute size-[18px] rounded-full border-[3px] border-surface-1 bg-live"
        style={{ left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}
      />
      <div
        aria-hidden="true"
        className="absolute size-3 rounded-full border-2 border-surface-1 bg-rose"
        style={{ left: "22%", top: "26%" }}
      />
      <div
        aria-hidden="true"
        className="absolute size-3 rounded-full border-2 border-surface-1 bg-rose"
        style={{ right: "20%", bottom: "22%" }}
      />
      <div className="absolute bottom-3 left-3 rounded-lg border border-line bg-bg px-[9px] py-1.5 font-mono text-[10px]">
        Radius 5 mi · S11
      </div>
    </div>
  );
}
