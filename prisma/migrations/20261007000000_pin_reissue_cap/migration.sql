-- Cap how many times a vendor can reissue a job's completion PIN.
--
-- Reissuing resets the wrong-guess counter, so an uncapped reissue let a
-- script guess its way to the PIN and release the payment without the client.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "completionPinReissues" INTEGER NOT NULL DEFAULT 0;
