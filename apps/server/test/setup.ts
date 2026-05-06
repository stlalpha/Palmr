import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach } from "vitest";

const tmpRoot = mkdtempSync(join(tmpdir(), "palmr-test-"));
const dbPath = join(tmpRoot, "test.db");

process.env.DATABASE_URL = `file:${dbPath}`;
process.env.ENABLE_S3 = "false";
process.env.NODE_ENV = "test";

beforeAll(() => {
  execSync("npx prisma db push --schema=./prisma/schema.prisma --skip-generate", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: "pipe",
  });
});

beforeEach(async () => {
  const { resetDb } = await import("./helpers/db.js");
  await resetDb();
});

afterAll(async () => {
  const { prisma } = await import("../src/shared/prisma.js");
  await prisma.$disconnect();
  try {
    rmSync(tmpRoot, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});
