-- Gas drip refills: an address may get more than one drip. Existing rows are first drips (seq 0).
ALTER TABLE "GasDrip" ADD COLUMN "seq" INTEGER NOT NULL DEFAULT 0;

DROP INDEX "GasDrip_address_key";

CREATE UNIQUE INDEX "GasDrip_address_seq_key" ON "GasDrip"("address", "seq");
