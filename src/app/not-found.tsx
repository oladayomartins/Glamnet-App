import Link from "next/link";
import { Compass } from "@phosphor-icons/react/dist/ssr";
import { EmptyState } from "@/components/ui";

/**
 * Not found (§S-02). Illustration slot, one line of plain English, one action.
 *
 * Deliberately vague about what was missing: a booking id that does not belong
 * to you returns this page too, and telling a stranger the difference between
 * "no such booking" and "not yours" is itself a disclosure.
 */
export default function NotFound() {
  return (
    <div className="py-14">
      <EmptyState
        icon={<Compass size={24} weight="light" />}
        title="That page is not here"
        action={
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full bg-metal px-6 text-sm font-bold text-metal-ink active:scale-[0.98]"
          >
            Back to the marketplace
          </Link>
        }
      >
        The link may be old, or the page may belong to someone else.
      </EmptyState>
    </div>
  );
}
