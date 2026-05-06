import type { Readable } from "node:stream";
import archiver from "archiver";

import { prisma } from "../../shared/prisma";
import { FileService } from "../file/service";

interface ZipEntry {
  objectName: string;
  pathInZip: string;
}

export class BulkDownloadService {
  constructor(private readonly fileService: FileService = new FileService()) {}

  /**
   * Build a streaming ZIP of the requested files plus the recursive contents of
   * the requested folders. Caller pipes the returned archive to the response —
   * archiver writes ZIP bytes incrementally as each entry's source stream drains,
   * so memory usage stays bounded regardless of total archive size.
   *
   * Compression is set to "store" (no DEFLATE) because the typical payload is
   * already-compressed media (mp3, mp4, jpg, pdf). DEFLATE-ing them wastes CPU
   * for ~zero size benefit. If callers want compression for text-heavy archives
   * we can plumb a flag through later.
   */
  async streamZip(opts: { fileIds: string[]; folderIds: string[]; userId: string }): Promise<archiver.Archiver> {
    // Validate ownership up front so we fail fast with a 404 rather than
    // beginning a partial archive and then erroring mid-stream.
    const ownedFiles = await prisma.file.findMany({
      where: { id: { in: opts.fileIds }, userId: opts.userId },
    });
    const missingFileIds = opts.fileIds.filter((id) => !ownedFiles.some((f) => f.id === id));
    if (missingFileIds.length > 0) {
      throw new Error(`File not found or access denied: ${missingFileIds.join(", ")}`);
    }

    const ownedFolders = await prisma.folder.findMany({
      where: { id: { in: opts.folderIds }, userId: opts.userId },
    });
    const missingFolderIds = opts.folderIds.filter((id) => !ownedFolders.some((f) => f.id === id));
    if (missingFolderIds.length > 0) {
      throw new Error(`Folder not found or access denied: ${missingFolderIds.join(", ")}`);
    }

    const entries: ZipEntry[] = ownedFiles.map((file) => ({
      objectName: file.objectName,
      pathInZip: file.name,
    }));

    for (const folder of ownedFolders) {
      const folderEntries = await this.collectFolderFiles(folder.id, folder.name);
      entries.push(...folderEntries);
    }

    const archive = archiver("zip", { store: true });

    // Append all entries. archiver queues them and reads each source stream
    // sequentially; the consumer (Fastify response) pulls bytes as they're
    // produced. Errors on individual streams propagate via archive.emit("error").
    for (const entry of entries) {
      // The storage abstraction types this as NodeJS.ReadableStream but the
      // underlying S3 client returns a Node Readable; archiver requires the
      // latter's narrower type.
      const stream = (await this.fileService.getObjectStream(entry.objectName)) as Readable;
      archive.append(stream, { name: entry.pathInZip });
    }

    // Kick off finalization. Errors during finalize surface on the archive's
    // "error" event, which Fastify forwards to the client as a connection drop.
    void archive.finalize();

    return archive;
  }

  private async collectFolderFiles(folderId: string, pathPrefix: string): Promise<ZipEntry[]> {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: { files: true, children: true },
    });
    if (!folder) return [];

    const result: ZipEntry[] = folder.files.map((file) => ({
      objectName: file.objectName,
      pathInZip: `${pathPrefix}/${file.name}`,
    }));

    for (const child of folder.children) {
      const childEntries = await this.collectFolderFiles(child.id, `${pathPrefix}/${child.name}`);
      result.push(...childEntries);
    }

    return result;
  }
}
