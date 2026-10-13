import { requireApiRole } from "@/lib/auth/api-guard";
import { errorResponse } from "@/lib/api/respond";
import { audit } from "./core";
import { csvResponse } from "./csv";

/**
 * An admin-only CSV download. Every export is audited: these files carry
 * people's names and emails off the platform, so who took one, and how many
 * rows, is on record.
 */
export function adminCsvRoute(
  name: string,
  build: (params: URLSearchParams) => Promise<{ csv: string; rows: number; summary: string }>,
) {
  return async (request: Request) => {
    try {
      const auth = await requireApiRole(["ADMIN"]);
      if ("response" in auth) return auth.response;
      const { csv, rows, summary } = await build(new URL(request.url).searchParams);
      await audit(auth.user.email, `export.${name}`, { type: "Export" }, `${rows} rows${summary ? ` — ${summary}` : ""}`);
      return csvResponse(name, csv);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
