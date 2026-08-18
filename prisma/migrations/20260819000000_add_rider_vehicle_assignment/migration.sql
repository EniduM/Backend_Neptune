-- Add nullable Rider -> Vehicle assignment (one vehicle per rider at a time)
ALTER TABLE "riders" ADD COLUMN "vehicle_id" UUID;

ALTER TABLE "riders" ADD CONSTRAINT "riders_vehicle_id_key" UNIQUE ("vehicle_id");

ALTER TABLE "riders" ADD CONSTRAINT "riders_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
