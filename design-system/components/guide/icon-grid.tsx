import {
  Broadcast,
  CalendarBlank,
  CheckCircle,
  Clock,
  CreditCard,
  Hourglass,
  ImageSquare,
  Lightning,
  LockSimple,
  MapPin,
  NavigationArrow,
  Prohibit,
  ShieldCheck,
  Sparkle,
  Star,
  Wallet,
} from "@phosphor-icons/react/dist/ssr";

/**
 * The house icon set — Phosphor at Light weight.
 *
 * Every entry is paired with the concept it names, because an icon in this
 * system never ships without a label outside the tab bar and icon-only 44px
 * controls.
 */
const icons = [
  { Icon: Sparkle, label: "services" },
  { Icon: CalendarBlank, label: "date" },
  { Icon: Clock, label: "time slot" },
  { Icon: Lightning, label: "emergency" },
  { Icon: MapPin, label: "sector" },
  { Icon: NavigationArrow, label: "en route" },
  { Icon: ImageSquare, label: "reference" },
  { Icon: Hourglass, label: "duration" },
  { Icon: ShieldCheck, label: "vetted" },
  { Icon: LockSimple, label: "address lock" },
  { Icon: CreditCard, label: "pre-auth" },
  { Icon: Broadcast, label: "broadcast" },
  { Icon: Star, label: "rating" },
  { Icon: Wallet, label: "earnings" },
  { Icon: Prohibit, label: "blocked" },
  { Icon: CheckCircle, label: "completed" },
];

export function IconGrid() {
  return (
    <div className="grid gap-1 rounded-card border border-line bg-surface-2 p-4 [grid-template-columns:repeat(auto-fill,minmax(104px,1fr))]">
      {icons.map(({ Icon, label }) => (
        <div
          key={label}
          className="flex flex-col items-center gap-[9px] rounded-tile px-1.5 py-4 transition-colors duration-[180ms] ease-gn hover:bg-rose-tint hover:text-rose-ink"
        >
          <Icon size={26} weight="light" />
          <span className="font-mono text-[10px] text-text-2">{label}</span>
        </div>
      ))}
    </div>
  );
}
