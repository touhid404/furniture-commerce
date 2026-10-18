-- Durable, validated merchant configuration. No existing records are modified.
CREATE TABLE "StoreSettings" (
    "id" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "profile" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);
