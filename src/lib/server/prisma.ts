import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { PrismaClient } from "@prisma/client";

/**
 * A single Prisma client per process. Next.js hot-reloads modules in
 * development, so the client is cached on `globalThis` to avoid exhausting
 * connections across reloads.
 *
 * Extended with one behaviour: every Notification row written anywhere is
 * also sent as a Web Push to its recipient's devices (see push.ts). The push
 * is scheduled with `after`, so it runs once the response is sent — after
 * any surrounding transaction has committed. The push step re-reads the rows
 * by id, so a notification whose transaction rolled back is never pushed.
 */

/** Queue a push for these notification ids, after the response. */
function schedulePush(ids: string[]) {
  if (ids.length === 0) return;
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  const run = () =>
    import("./push")
      .then((push) => push.pushForNotifications(ids))
      .catch((error) => console.error("[push] dispatch failed", error));
  try {
    after(run);
  } catch {
    // Outside a request (a script): send straight away.
    void run();
  }
}

/** Notification ids are set here so pushes can find the rows afterwards. */
const notificationId = () => `ntf_${randomUUID().replace(/-/g, "")}`;

function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  }).$extends({
    query: {
      notification: {
        async create({ args, query }) {
          const id = args.data.id ?? notificationId();
          const row = await query({ ...args, data: { ...args.data, id } });
          schedulePush([id]);
          return row;
        },
        async createMany({ args, query }) {
          const rows = (Array.isArray(args.data) ? args.data : [args.data]).map((row) => ({
            ...row,
            id: row.id ?? notificationId(),
          }));
          const result = await query({ ...args, data: rows });
          schedulePush(rows.map((row) => row.id));
          return result;
        },
      },
    },
  });
}

type ExtendedClient = ReturnType<typeof createClient>;

/** The client, or the transaction client handed to `$transaction(async (tx) => …)`. */
export type Db = ExtendedClient | Omit<ExtendedClient, "$extends" | "$transaction" | "$connect" | "$disconnect" | "$on">;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
