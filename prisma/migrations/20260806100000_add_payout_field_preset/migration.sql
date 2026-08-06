-- Пресеты полей формы выплаты по xml-коду направления
CREATE TABLE IF NOT EXISTS "PayoutFieldPreset" (
    "xml" TEXT NOT NULL,
    "fields" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayoutFieldPreset_pkey" PRIMARY KEY ("xml")
);
