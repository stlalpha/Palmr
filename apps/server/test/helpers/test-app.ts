import { buildApp } from "../../src/app";
import { fileRoutes } from "../../src/modules/file/routes";
import { reverseShareRoutes } from "../../src/modules/reverse-share/routes";
import { shareRoutes } from "../../src/modules/share/routes";

export async function buildTestApp() {
  const app = await buildApp();
  app.register(shareRoutes);
  app.register(reverseShareRoutes);
  app.register(fileRoutes);
  await app.ready();
  return app;
}
