import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

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
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
