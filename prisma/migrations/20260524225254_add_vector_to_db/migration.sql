CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "Resident" ADD COLUMN     "embedding" vector(512);

