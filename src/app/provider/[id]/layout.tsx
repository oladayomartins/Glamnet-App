import { VendorShell } from "./vendor-shell";

/**
 * The vendor app shell around every /provider/:id page: tabs, the request
 * badge and pull-to-refresh.
 *
 * Its `data-vendor-app` marker hides the customer site footer (see
 * globals.css): links like "Book a service" are clutter to someone running
 * their business here.
 */
export default async function VendorLayout({
  children,
  params,
}: LayoutProps<"/provider/[id]">) {
  const { id } = await params;

  return <VendorShell providerId={id}>{children}</VendorShell>;
}
