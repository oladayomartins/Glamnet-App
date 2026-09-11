-- The customer's written review, alongside the numeric rating.
--
-- Defaulted rather than nullable: "not reviewed" is already expressed by the
-- booking's status and by `rating` being null, so a second way of saying it
-- would be a third state nobody needs.
ALTER TABLE "Booking" ADD COLUMN "reviewNote" TEXT NOT NULL DEFAULT '';
