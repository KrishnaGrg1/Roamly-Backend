/*
  Warnings:

  - You are about to drop the column `feedback` on the `AiInteraction` table. All the data in the column will be lost.
  - You are about to drop the column `locationId` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `mediaType` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `mediaUrl` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `budget` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the column `startLocation` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the `Route` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TravelHistory` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[googlePlaceId]` on the table `Location` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tripId]` on the table `Post` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `purpose` to the `AiInteraction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tripId` to the `Post` table without a default value. This is not possible if the table is not empty.
  - Added the required column `destination` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `source` to the `Trip` table without a default value. This is not possible if the table is not empty.

*/

-- Step 1: Handle existing data - Add purpose column with default for existing records
-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_locationId_fkey";

-- DropForeignKey
ALTER TABLE "Route" DROP CONSTRAINT "Route_userId_fkey";

-- DropForeignKey
ALTER TABLE "TravelHistory" DROP CONSTRAINT "TravelHistory_userId_fkey";

-- DropIndex
DROP INDEX "Post_locationId_idx";

-- Step 2: Migrate Trip table first
-- AlterTable Trip - add new columns with defaults for existing records
ALTER TABLE "Trip" DROP COLUMN "budget",
DROP COLUMN "startLocation",
ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "aiVersion" TEXT,
ADD COLUMN     "budgetMax" DOUBLE PRECISION,
ADD COLUMN     "budgetMin" DOUBLE PRECISION,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "destination" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "title" TEXT;

-- Set default values for existing Trip records
UPDATE "Trip" SET "source" = 'Unknown', "destination" = 'Unknown' WHERE "source" IS NULL;

-- Now make them required
ALTER TABLE "Trip" ALTER COLUMN "source" SET NOT NULL;
ALTER TABLE "Trip" ALTER COLUMN "destination" SET NOT NULL;

-- Step 3: Create a unique Trip record for each existing Post
-- Each post will get its own trip with legacy marker
INSERT INTO "Trip" (id, "userId", status, source, destination, days, itinerary, "createdAt", title)
SELECT 
  gen_random_uuid(),
  p."userId",
  'COMPLETED',
  COALESCE((SELECT name FROM "Location" WHERE id = p."locationId"), 'Legacy Location'),
  COALESCE((SELECT name FROM "Location" WHERE id = p."locationId"), 'Legacy Location'),
  1,
  '{"type": "legacy", "note": "Migrated from standalone post"}'::json,
  p."createdAt",
  CONCAT('Legacy Trip from Post ', p.id)
FROM "Post" p;

-- Step 4: Add tripId column to Post as nullable first
ALTER TABLE "Post" ADD COLUMN "tripId" TEXT;

-- Step 5: Map each post to its corresponding newly created trip
UPDATE "Post" p
SET "tripId" = (
  SELECT t.id 
  FROM "Trip" t 
  WHERE t."userId" = p."userId" 
    AND t.title = CONCAT('Legacy Trip from Post ', p.id)
  LIMIT 1
);

-- Step 6: Now make tripId required and add constraints
ALTER TABLE "Post" ALTER COLUMN "tripId" SET NOT NULL;

-- Step 7: Drop old Post columns
ALTER TABLE "Post" DROP COLUMN "locationId",
DROP COLUMN "mediaType",
DROP COLUMN "mediaUrl";

-- Step 8: Update other tables
-- AlterTable AiInteraction
ALTER TABLE "AiInteraction" DROP COLUMN "feedback",
ADD COLUMN     "purpose" TEXT;

-- Set default purpose for existing AI interactions
UPDATE "AiInteraction" SET "purpose" = 'legacy_interaction' WHERE "purpose" IS NULL;
ALTER TABLE "AiInteraction" ALTER COLUMN "purpose" SET NOT NULL;

-- AlterTable Location
ALTER TABLE "Location" ADD COLUMN     "googlePlaceId" TEXT;

-- AlterTable Review
ALTER TABLE "Review" ADD COLUMN     "tripId" TEXT;

-- Step 9: Drop deprecated tables
DROP TABLE "Route";
DROP TABLE "TravelHistory";

-- Step 10: Create indexes and constraints
CREATE UNIQUE INDEX "Location_googlePlaceId_key" ON "Location"("googlePlaceId");
CREATE UNIQUE INDEX "Post_tripId_key" ON "Post"("tripId");

-- Step 11: Add foreign key
ALTER TABLE "Post" ADD CONSTRAINT "Post_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
