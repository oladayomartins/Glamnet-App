import { VendorNav } from "./vendor-nav";

/**
 * The vendor app shell around every /provider/:id page.
 *
 * `data-vendor-app` hides the customer site footer (see globals.css): links
 * like "Book a service" are clutter to someone running their business here.
 * The bottom padding keeps the last card clear of the phone tab bar.
 */
export default async function VendorLayout({
  children,
  params,
}: LayoutProps<"/provider/[id]">) {
  const { id } = await params;

  return (
    <div data-vendor-app className="pb-24 md:pb-0">
      <VendorNav providerId={id} placement="top" />
      {children}
      <VendorNav providerId={id} placement="bottom" />
    </div>
  );
}
