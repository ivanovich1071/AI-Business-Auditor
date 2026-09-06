-- CreateTable
CREATE TABLE "CrawlJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT,
    "startUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "maxPages" INTEGER NOT NULL DEFAULT 200,
    "maxDepth" INTEGER NOT NULL DEFAULT 5,
    "pagesDone" INTEGER NOT NULL DEFAULT 0,
    "pagesFailed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME,
    CONSTRAINT "CrawlJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrawledPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "crawlId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "markdown" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "statusCode" INTEGER,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrawledPage_crawlId_fkey" FOREIGN KEY ("crawlId") REFERENCES "CrawlJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CrawledPage_crawlId_url_key" ON "CrawledPage"("crawlId", "url");
