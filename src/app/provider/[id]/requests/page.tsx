import { RequestsInbox } from "../requests-inbox";
import { requireVendorPage } from "../access";

export const dynamic = "force-dynamic";

/** The Requests tab: the broadcast inbox on its own. */
export default async function VendorRequestsPage({ params }: PageProps<"/provider/[id]/requests">) {
  const { id } = await params;
  await requireVendorPage(id, `/provider/${id}/requests`);

  return <RequestsInbox providerId={id} />;
}
