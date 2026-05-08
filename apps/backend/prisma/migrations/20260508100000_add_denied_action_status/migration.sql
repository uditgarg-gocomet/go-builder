-- AlterEnum: add DENIED value to ActionStatus
ALTER TYPE "ActionStatus" ADD VALUE IF NOT EXISTS 'DENIED';
