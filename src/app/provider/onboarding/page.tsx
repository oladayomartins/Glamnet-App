import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { requireRole } from "@/lib/auth/session";
import { onboardingGaps } from "@/lib/server/provider-portal";
import { paymentGateway } from "@/lib/server/payments";
import { isImageKitConfigured } from "@/lib/imagekit";
import { siteUrl } from "@/lib/site";
import { listCategories } from "@/lib/server/categories";
import { OnboardingWizard } from "./wizard";

export const dynamic = "force-dynamic";

/**
 * The 2-minute sign-up wizard (Directory §C, Flow 3):
 * profile → storefront link & socials → workspace → menu → lookbook →
 * compliance documents → payouts → submit for review.
 *
 * Also the vendor's place to edit their storefront later, so it opens for
 * approved vendors too, not only applicants.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; payouts?: string }>;
}) {
  const user = await requireRole("PROVIDER", "/provider/onboarding");
  if (!user.providerId) redirect("/forbidden");
  const { step, payouts } = await searchParams;

  const [provider, catalogue, gaps, categories] = await Promise.all([
    prisma.provider.findUniqueOrThrow({
      where: { id: user.providerId },
      include: {
        services: true,
        documents: { orderBy: { uploadedAt: "desc" } },
        lookbook: { orderBy: { position: "asc" } },
      },
    }),
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { kind: "asc" }, { name: "asc" }],
    }),
    onboardingGaps(user.providerId),
    listCategories(),
  ]);

  const hubOrder = categories.map((hub) => hub.name);

  return (
    <OnboardingWizard
      initialStep={step ?? null}
      welcome={!step && !provider.slug && provider.services.length === 0 && provider.onboardedAt === null}
      payoutsNotice={payouts ?? null}
      siteOrigin={siteUrl().replace(/^https?:\/\//, "")}
      testPayments={paymentGateway().mode === "simulated"}
      uploadsEnabled={isImageKitConfigured()}
      approved={user.providerApproved}
      submitted={provider.onboardedAt !== null}
      gaps={gaps}
      categories={categories.map(({ slug, name, emoji, blurb, imageUrl }) => ({ slug, name, emoji, blurb, imageUrl }))}
      profile={{
        name: provider.name,
        phone: provider.phone,
        bio: provider.bio,
        slug: provider.slug ?? "",
        instagramHandle: provider.instagramHandle,
        tiktokHandle: provider.tiktokHandle,
        workspaceType: provider.workspaceType,
        workspacePostcode: provider.basePostcode || provider.workspaceSector,
        travelsToClients: provider.travelsToClients,
        payoutsEnabled: provider.payoutsEnabled,
        avatar: provider.avatarUrl
          ? { url: provider.avatarUrl, fileId: provider.avatarFileId }
          : null,
      }}
      catalogue={catalogue
        // A hidden category is closed to new picks.
        .filter((service) => hubOrder.includes(service.category))
        .map((service) => ({
          id: service.id,
          name: service.name,
          category: service.category,
          kind: service.kind,
          priceMinor: service.priceMinor,
          durationMinutes: service.durationMinutes,
        }))
        .sort(
          (a, b) =>
            (hubOrder.indexOf(a.category) + 1 || 99) - (hubOrder.indexOf(b.category) + 1 || 99),
        )}
      menu={provider.services.map((link) => ({
        serviceId: link.serviceId,
        priceMinor: link.priceMinor,
        durationMinutes: link.durationMinutes,
      }))}
      documents={provider.documents.map((document) => ({
        id: document.id,
        kind: document.kind,
        fileName: document.fileName,
        status: document.status,
      }))}
      lookbook={provider.lookbook.map((image) => ({
        url: image.url,
        fileId: image.fileId,
        caption: image.caption,
      }))}
    />
  );
}
