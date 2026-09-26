# Migrations

A database built from this folder alone must be one the application can
actually start against. Until `20260919000000_app_user_approval_and_media` it
was not: the history stopped short of `AppUser`, vendor approval and the media
columns, and a fresh environment came up with no authentication, no approval
and no matching.

It went unnoticed because environments were created with `prisma db push`,
which writes the schema directly and never reads this folder. Nothing built
from the history was ever started, so nothing ever failed.

## A database that was created with `db push`

**`prisma migrate deploy` will refuse.** It is not a question of the SQL being
safe — Prisma checks first and stops:

```
Error: P3005
The database schema is not empty.
```

It has no `_prisma_migrations` table, so from Prisma's point of view a
non-empty schema appeared from nowhere. Baseline it once, marking the
migrations whose objects are already there as applied, and deploy after that
behaves normally:

```sh
prisma migrate resolve --applied 20260910000000_init
prisma migrate resolve --applied 20260911000000_booking_review_note
prisma migrate deploy
```

That applies only the third migration. Its statements are guarded
(`IF NOT EXISTS`, and a `DO` block for the foreign keys, since Postgres has no
`ADD CONSTRAINT IF NOT EXISTS`), so the objects `db push` already created are
stepped over rather than collided with.

Verify with `prisma migrate diff --from-url "$DATABASE_URL"
--to-schema-datamodel prisma/schema.prisma --script`. Silence — or "This is an
empty migration" — means the database and the schema agree.

## A vendor table that predates approval

`approvalStatus` defaults to `PENDING`, which is right for a row created from
now on. On a database carrying vendors from before the column existed, adding
it takes every one of them off the marketplace at once: the matching query
only broadcasts to `APPROVED`.

The migration does not back-fill. Who is approved is a vetting decision, not
something a migration should invent. Check the table after deploying to such a
database.

## Deploying

`build` is `prisma migrate deploy && next build`, so every Vercel deployment
applies the history before it serves anything from it.

It was `next build` alone, and that is how production broke on 2026-09-26.
Four migrations sat in this folder unapplied while code that needed them went
live: `ProviderService.isFeatured` is read by `SERVICE_SELECT`, which the
directory, the storefront and the city pages all use, so the whole browsing
surface returned a server error. Nothing in CI could have caught it — the
build passes against a database that has the columns, and the tests never
touch Postgres. Only the live site knew.

Two consequences worth keeping in mind:

- **A failed migration now fails the deploy.** That is the intent: a half-
  deployed schema is worse than a deployment that did not happen, and the
  previous build stays live while it is fixed.
- **Migrations must be safe to apply before the new code is serving.** A
  migration runs against the *old* code for as long as the build takes, so
  destructive changes need the usual two-step: add and back-fill in one
  release, drop in the next.

## From here on

Use `prisma migrate dev` to make a change, so the history and the schema move
together. `db push` is for throwaway databases only — it is what put the two
out of step in the first place.
