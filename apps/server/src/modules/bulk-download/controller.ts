import type { FastifyReply, FastifyRequest } from "fastify";

import { BulkDownloadSchema } from "./dto";
import { BulkDownloadService } from "./service";

/**
 * Build a Content-Disposition header that's correct for both legacy
 * (Latin-1 only) and modern (RFC 5987) clients. Modern browsers prefer
 * the filename* parameter, legacy clients fall back to the quoted form.
 */
function buildContentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'") || "download.zip";
  const utf8Encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Encoded}`;
}

export class BulkDownloadController {
  private readonly service = new BulkDownloadService();

  async bulkDownload(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as { user?: { userId?: string } }).user?.userId;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { fileIds, folderIds, zipName } = BulkDownloadSchema.parse(request.body);
      const archive = await this.service.streamZip({ fileIds, folderIds, userId });

      const filename = zipName.toLowerCase().endsWith(".zip") ? zipName : `${zipName}.zip`;
      reply.header("Content-Type", "application/zip");
      reply.header("Content-Disposition", buildContentDisposition(filename));

      // Surface archiver errors to the client as a closed connection rather
      // than a half-written ZIP that might appear to succeed.
      archive.on("error", (err) => {
        request.log.error({ err }, "[BulkDownload] archive stream error");
        if (!reply.sent) {
          reply.status(500).send({ error: "Failed to build ZIP archive" });
        } else {
          reply.raw.destroy(err);
        }
      });

      return reply.send(archive);
    } catch (error) {
      const err = error as Error & { errors?: unknown };
      if (err.message?.startsWith("File not found") || err.message?.startsWith("Folder not found")) {
        return reply.status(404).send({ error: err.message });
      }
      if (err.errors) {
        return reply.status(400).send({ error: err.message });
      }
      request.log.error({ err }, "[BulkDownload] unexpected error");
      return reply.status(500).send({ error: "Failed to build ZIP archive" });
    }
  }
}
