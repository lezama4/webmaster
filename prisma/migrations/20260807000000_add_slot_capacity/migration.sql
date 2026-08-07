-- AlterTable
-- Optional "aforo máximo" (max attendee capacity) a centre may set on a Slot.
-- Nullable: existing Slots and the current seed predate the field.
ALTER TABLE "slots" ADD COLUMN "capacity" INTEGER;
