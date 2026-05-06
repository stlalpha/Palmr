import { buildApp } from "../../src/app";
import { reverseShareRoutes } from "../../src/modules/reverse-share/routes";
import { shareRoutes } from "../../src/modules/share/routes";

export async function buildTestApp() {
  const app = await buildApp();
  app.register(shareRoutes);
  app.register(reverseShareRoutes);
  await app.ready();
  return app;
}
