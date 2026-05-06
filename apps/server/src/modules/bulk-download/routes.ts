import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { BulkDownloadController } from "./controller";
import { BulkDownloadSchema } from "./dto";

export async function bulkDownloadRoutes(app: FastifyInstance) {
  const controller = new BulkDownloadController();

  const preValidation = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  };

  app.post(
    "/bulk-download",
    {
      preValidation,
      schema: {
        tags: ["Bulk Download"],
        operationId: "bulkDownload",
        summary: "Stream a ZIP of selected files and folders",
        description:
          "Streams a single ZIP archive containing all requested files and the recursive contents of all requested folders. Folder structure is preserved in the archive.",
        body: BulkDownloadSchema,
        // The 200 response is a binary application/zip stream rather than JSON,
        // so we don't declare its schema; Fastify-Zod won't try to validate it.
        // Errors are JSON.
        response: {
          400: z.object({ error: z.string() }),
          401: z.object({ error: z.string() }),
          404: z.object({ error: z.string() }),
          500: z.object({ error: z.string() }),
        },
      },
    },
    controller.bulkDownload.bind(controller)
  );
}
