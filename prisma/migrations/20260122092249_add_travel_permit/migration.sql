-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "destinationInfoId" TEXT;

-- CreateTable
CREATE TABLE "DestinationInfo" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minDays" INTEGER NOT NULL DEFAULT 1,
    "maxDays" INTEGER,
    "difficulty" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DestinationInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtectedArea" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "feesNPR" JSONB NOT NULL,
    "childPolicy" TEXT NOT NULL,
    "paymentLocation" JSONB NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtectedArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrekkingPermit" (
    "id" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "feeUSD" JSONB NOT NULL,
    "issuingAuthority" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrekkingPermit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MountaineeringRoyalty" (
    "id" TEXT NOT NULL,
    "mountain" TEXT,
    "category" TEXT,
    "heightM" INTEGER,
    "route" TEXT,
    "currency" TEXT NOT NULL,
    "royalty" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MountaineeringRoyalty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonDefinition" (
    "id" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "months" JSONB NOT NULL,

    CONSTRAINT "SeasonDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DestinationInfo_name_key" ON "DestinationInfo"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProtectedArea_name_key" ON "ProtectedArea"("name");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_destinationInfoId_fkey" FOREIGN KEY ("destinationInfoId") REFERENCES "DestinationInfo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
