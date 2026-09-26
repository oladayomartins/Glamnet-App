import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { safeNext } from "@/lib/auth/safe-next";

export const dynamic = "force-dynamic";

/**
 * POST-only sign-out.
 *
 * Not a GET: a link that signs you out can be triggered by any page that
 * embeds it as an image, and browsers prefetch GETs.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  // An optional same-site return path, e.g. back to the admin door.
  const form = await request.formData().catch(() => null);
  const next = safeNext(form?.get("next")?.toString(), "/");
  return NextResponse.redirect(new URL(next, request.url), { status: 303 });
}
