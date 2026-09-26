import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guard";
import { errorResponse } from "./respond";

type Context<P> = { params: Promise<P> };

/**
 * Wraps an admin API handler: ADMIN only, JSON in and out, errors in the
 * standard envelope. `body` is null for requests without one.
 */
export function adminRoute<P = Record<string, never>>(
  handler: (input: { actor: string; params: P; body: unknown; request: Request }) => Promise<unknown>,
) {
  return async (request: Request, context: Context<P>) => {
    try {
      const auth = await requireApiRole(["ADMIN"]);
      if ("response" in auth) return auth.response;
      const params = (await context?.params) ?? ({} as P);
      const text = request.method === "GET" || request.method === "DELETE" ? "" : await request.text();
      const body: unknown = text ? JSON.parse(text) : null;
      const result = await handler({ actor: auth.user.email, params, body, request });
      return NextResponse.json(result ?? { ok: true });
    } catch (error) {
      if (error instanceof SyntaxError) {
        return NextResponse.json(
          { error: { code: "INVALID_REQUEST", message: "The request body was not valid JSON." } },
          { status: 400 },
        );
      }
      return errorResponse(error);
    }
  };
}
