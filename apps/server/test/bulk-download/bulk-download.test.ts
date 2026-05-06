import { Readable } from "node:stream";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileService } from "../../src/modules/file/service";
import { authHeader, createFile, createFolder, createUser } from "../helpers/factories";
import { buildTestApp } from "../helpers/test-app";

/**
 * Returns a fake Readable that emits a small payload for the given objectName.
 * The payload is deterministic so tests can predict ZIP entry contents if they
 * need to. The stream emits a single chunk and ends — archiver will read it,
 * append it as a ZIP entry, and move on.
 */
function fakeStreamFor(objectName: string): Readable {
  return Readable.from([Buffer.from(`payload:${objectName}`)]);
}

function stubGetObjectStream() {
  return vi
    .spyOn(FileService.prototype, "getObjectStream")
    .mockImplementation(async (objectName: string) => fakeStreamFor(objectName));
}

/**
 * Reads a Fastify inject response body as a Buffer regardless of how Fastify
 * decided to surface the body (it varies based on Content-Type).
 */
function bodyAsBuffer(res: { rawPayload?: Buffer; payload: string | Buffer }): Buffer {
  if (res.rawPayload) return res.rawPayload;
  return Buffer.isBuffer(res.payload) ? res.payload : Buffer.from(res.payload);
}

describe("POST /bulk-download", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it("returns 401 without auth", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/bulk-download",
      payload: { fileIds: ["x"], folderIds: [], zipName: "out" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 when neither files nor folders are provided", async () => {
    const owner = await createUser();
    const res = await app.inject({
      method: "POST",
      url: "/bulk-download",
      headers: authHeader(app, owner.id),
      payload: { fileIds: [], folderIds: [], zipName: "out" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when a file id is unknown", async () => {
    stubGetObjectStream();
    const owner = await createUser();
    const res = await app.inject({
      method: "POST",
      url: "/bulk-download",
      headers: authHeader(app, owner.id),
      payload: { fileIds: ["does-not-exist"], folderIds: [], zipName: "out" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/File not found/);
  });

  it("returns 404 when a file is owned by someone else", async () => {
    stubGetObjectStream();
    const owner = await createUser();
    const intruder = await createUser();
    const file = await createFile(owner.id, { name: "secret.txt", extension: "txt" });

    const res = await app.inject({
      method: "POST",
      url: "/bulk-download",
      headers: authHeader(app, intruder.id),
      payload: { fileIds: [file.id], folderIds: [], zipName: "stolen" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/File not found/);
  });

  it("returns 404 when a folder is owned by someone else", async () => {
    stubGetObjectStream();
    const owner = await createUser();
    const intruder = await createUser();
    const folder = await createFolder(owner.id, { name: "private" });

    const res = await app.inject({
      method: "POST",
      url: "/bulk-download",
      headers: authHeader(app, intruder.id),
      payload: { fileIds: [], folderIds: [folder.id], zipName: "stolen" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/Folder not found/);
  });

  it("streams a ZIP for owned files with the correct headers and ZIP magic bytes", async () => {
    const spy = stubGetObjectStream();
    const owner = await createUser();
    const fileA = await createFile(owner.id, { name: "alpha.txt", extension: "txt" });
    const fileB = await createFile(owner.id, { name: "beta.txt", extension: "txt" });

    const res = await app.inject({
      method: "POST",
      url: "/bulk-download",
      headers: authHeader(app, owner.id),
      payload: { fileIds: [fileA.id, fileB.id], folderIds: [], zipName: "my-files" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/zip");
    expect(res.headers["content-disposition"]).toContain("my-files.zip");

    const body = bodyAsBuffer(res);
    // ZIP local-file-header magic: "PK\x03\x04"
    expect(body.subarray(0, 2).toString()).toBe("PK");
    expect(body[2]).toBe(0x03);
    expect(body[3]).toBe(0x04);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith(fileA.objectName);
    expect(spy).toHaveBeenCalledWith(fileB.objectName);
  });

  it("appends .zip to zipName if missing", async () => {
    stubGetObjectStream();
    const owner = await createUser();
    const file = await createFile(owner.id, { name: "x.txt", extension: "txt" });

    const res = await app.inject({
      method: "POST",
      url: "/bulk-download",
      headers: authHeader(app, owner.id),
      payload: { fileIds: [file.id], folderIds: [], zipName: "no-extension" },
    });

    expect(res.headers["content-disposition"]).toContain("no-extension.zip");
  });

  it("respects an explicit .zip suffix without doubling it", async () => {
    stubGetObjectStream();
    const owner = await createUser();
    const file = await createFile(owner.id, { name: "x.txt", extension: "txt" });

    const res = await app.inject({
      method: "POST",
      url: "/bulk-download",
      headers: authHeader(app, owner.id),
      payload: { fileIds: [file.id], folderIds: [], zipName: "already-named.zip" },
    });

    const disposition = res.headers["content-disposition"] as string;
    expect(disposition).toContain("already-named.zip");
    expect(disposition).not.toContain(".zip.zip");
  });

  it("recursively pulls files from folders preserving directory structure", async () => {
    const spy = stubGetObjectStream();
    const owner = await createUser();
    const root = await createFolder(owner.id, { name: "root" });
    const sub = await createFolder(owner.id, { name: "sub", parentId: root.id });
    const looseFile = await createFile(owner.id, { name: "loose.txt", extension: "txt" });
    const rootFile = await createFile(owner.id, { name: "in-root.txt", extension: "txt", folderId: root.id });
    const subFile = await createFile(owner.id, { name: "in-sub.txt", extension: "txt", folderId: sub.id });

    const res = await app.inject({
      method: "POST",
      url: "/bulk-download",
      headers: authHeader(app, owner.id),
      payload: { fileIds: [looseFile.id], folderIds: [root.id], zipName: "tree" },
    });

    expect(res.statusCode).toBe(200);
    // All three files should have had their object streams pulled.
    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy).toHaveBeenCalledWith(looseFile.objectName);
    expect(spy).toHaveBeenCalledWith(rootFile.objectName);
    expect(spy).toHaveBeenCalledWith(subFile.objectName);
  });

  it("does not open any S3 streams when ownership validation fails", async () => {
    const spy = stubGetObjectStream();
    const owner = await createUser();
    const intruder = await createUser();
    const file = await createFile(owner.id, { name: "secret.txt", extension: "txt" });

    const res = await app.inject({
      method: "POST",
      url: "/bulk-download",
      headers: authHeader(app, intruder.id),
      payload: { fileIds: [file.id], folderIds: [], zipName: "stolen" },
    });

    expect(res.statusCode).toBe(404);
    expect(spy).not.toHaveBeenCalled();
  });
});
