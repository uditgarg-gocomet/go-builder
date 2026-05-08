-- AlterTable
ALTER TABLE "RegistryEntryVersion" ADD COLUMN "group" TEXT;
ALTER TABLE "RegistryEntryVersion" ADD COLUMN "releasedAt" TIMESTAMP(3);
