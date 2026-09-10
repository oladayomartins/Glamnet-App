import { Lightning } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";

/**
 * The emergency banner that heads the checkout card.
 *
 * Signal red, the bolt, and the literal word EMERGENCY travel together — every
 * time, on every surface. Never signal the classification with colour alone,
 * and never say "surge" to a customer.
 */
export function EmergencyNotice({
  title = "EMERGENCY BOOKING",
  body = "Your appointment is within 12 hours and is subject to our emergency booking rate.",
  className,
}: {
  title?: string;
  body?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-b border-emergency bg-emergency-tint px-[18px] py-4",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-[13px] font-bold tracking-[0.06em] text-emergency-ink">
        <span className="flex size-[22px] shrink-0 animate-[gn-breathe_2.2s_ease-in-out_infinite] items-center justify-center rounded-full bg-emergency text-emergency-on">
          <Lightning size={13} />
        </span>
        {title}
      </div>
      <div className="mt-2 text-[13px] leading-[1.55] text-emergency-ink">
        {body}
      </div>
    </div>
  );
}
