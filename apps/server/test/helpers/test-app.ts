import { buildApp } from "../../src/app";
import { bulkDownloadRoutes } from "../../src/modules/bulk-download/routes";
import { fileRoutes } from "../../src/modules/file/routes";
import { reverseShareRoutes } from "../../src/modules/reverse-share/routes";
import { shareRoutes } from "../../src/modules/share/routes";

export async function buildTestApp() {
  const app = await buildApp();
  app.register(shareRoutes);
  app.register(reverseShareRoutes);
  app.register(fileRoutes);
  app.register(bulkDownloadRoutes);
  await app.ready();
  return app;
}
