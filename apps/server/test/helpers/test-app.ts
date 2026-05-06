import { buildApp } from "../../src/app";
import { shareRoutes } from "../../src/modules/share/routes";

export async function buildTestApp() {
  const app = await buildApp();
  app.register(shareRoutes);
  await app.ready();
  return app;
}
