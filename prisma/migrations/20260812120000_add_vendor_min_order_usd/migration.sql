-- Порог заявки в USD для фида курсов вендора: export.xml отдаёт тир, в который
-- попадает заявка такого размера.
ALTER TABLE "Vendors" ADD COLUMN IF NOT EXISTS "minOrderUsd" DOUBLE PRECISION NOT NULL DEFAULT 350;
