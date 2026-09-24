const STYLE = {
  LIVE: "bg-normal-soft text-normal-ink ring-normal/25",
  SCHEDULED: "bg-accent-100 text-accent-700 ring-accent-500/30",
  PAUSED: "bg-sunken text-ink-muted ring-line",
  ENDED: "bg-sunken text-ink-muted ring-line",
} as const;

export function SchedulePill({ schedule }: { schedule: keyof typeof STYLE }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider ring-1 ${STYLE[schedule]}`}>
      {schedule.toLowerCase()}
    </span>
  );
}
