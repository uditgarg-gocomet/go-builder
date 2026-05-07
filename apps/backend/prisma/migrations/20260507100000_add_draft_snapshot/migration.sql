-- CreateTable
CREATE TABLE "DraftSnapshot" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "schemaHash" TEXT NOT NULL,
    "nodeCount" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "label" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DraftSnapshot_pageId_createdAt_idx" ON "DraftSnapshot"("pageId", "createdAt");

-- CreateIndex
CREATE INDEX "DraftSnapshot_pageId_schemaHash_idx" ON "DraftSnapshot"("pageId", "schemaHash");
