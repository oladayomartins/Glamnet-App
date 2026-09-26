# `demo/vercel-preview`

A throwaway branch so the rebranded UI can be clicked through on a real URL.
**Do not merge it.**

It sits on top of `design-system/brand-guide-v1.2` and adds one thing: a shim
that lets the app's SQLite database work on a serverless filesystem. See
`src/lib/server/database-url.ts` for the detail.

## What that means for the deployed app

- The database is **seeded at build time** and copied to `/tmp` on cold start.
- Writes work, but only for the life of that instance. Create a booking and it
  is real until the instance recycles, then the data is back to the seed.
- Anything you change in the admin config behaves the same way.

So: fine for walking through screens, wrong for anything else.

## Turning this into a real deployment

Set `DATABASE_URL` to a Postgres connection string. The shim passes any
non-`file:` URL straight through, and `prisma/schema.prisma` was written to
port by changing the datasource alone — no SQLite-only constructs, enums
modelled as checked strings, money as integer pence. The existing migrations
are SQLite-flavoured SQL, so they need regenerating against Postgres.

Once that is done, this branch has no reason to exist: drop the shim,
`next.config.ts`'s `outputFileTracingIncludes`, and the `vercel-build` script.
