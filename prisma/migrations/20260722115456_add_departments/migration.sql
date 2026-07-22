-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Analysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "agents" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "businessProcesses" TEXT NOT NULL,
    "departments" TEXT NOT NULL DEFAULT '[]',
    "pains" TEXT NOT NULL,
    "confidence" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Analysis_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Analysis" ("agents", "businessProcesses", "companyId", "confidence", "createdAt", "id", "pains", "summary") SELECT "agents", "businessProcesses", "companyId", "confidence", "createdAt", "id", "pains", "summary" FROM "Analysis";
DROP TABLE "Analysis";
ALTER TABLE "new_Analysis" RENAME TO "Analysis";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
