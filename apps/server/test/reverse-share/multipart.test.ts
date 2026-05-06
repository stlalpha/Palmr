import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileService } from "../../src/modules/file/service";
import { createReverseShare, createUser } from "../helpers/factories";
import { buildTestApp } from "../helpers/test-app";

const FAKE_UPLOAD_ID = "test-upload-id";
const FAKE_PRESIGNED_URL = "https://example.test/presigned/part";

function stubFileService() {
  vi.spyOn(FileService.prototype, "createMultipartUpload").mockResolvedValue(FAKE_UPLOAD_ID);
  vi.spyOn(FileService.prototype, "getPresignedPartUrl").mockResolvedValue(FAKE_PRESIGNED_URL);
  vi.spyOn(FileService.prototype, "completeMultipartUpload").mockResolvedValue(undefined);
  vi.spyOn(FileService.prototype, "abortMultipartUpload").mockResolvedValue(undefined);
}

describe("POST /reverse-shares/alias/:alias/multipart/create", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
    stubFileService();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it("returns 200 with uploadId and objectName for a valid request", async () => {
    const owner = await createUser();
    await createReverseShare(owner.id, { alias: "drop" });

    const res = await app.inject({
      method: "POST",
      url: "/reverse-shares/alias/drop/multipart/create",
      payload: { filename: "video", extension: "mp4" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.uploadId).toBe(FAKE_UPLOAD_ID);
    expect(body.objectName).toMatch(/^reverse-shares\/drop\/.+-video\.mp4$/);
    expect(body.message).toBe("Multipart upload initialized");
    expect(FileService.prototype.createMultipartUpload).toHaveBeenCalledOnce();
    expect(FileService.prototype.createMultipartUpload).toHaveBeenCalledWith(body.objectName);
  });

  it("returns 404 for an unknown alias", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/reverse-shares/alias/doesnotexist/multipart/create",
      payload: { filename: "x", extension: "bin" },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Reverse share not found");
    expect(FileService.prototype.createMultipartUpload).not.toHaveBeenCalled();
  });

  it("returns 403 when the reverse share is inactive", async () => {
    const owner = await createUser();
    await createReverseShare(owner.id, { alias: "off", isActive: false });

    const res = await app.inject({
      method: "POST",
      url: "/reverse-shares/alias/off/multipart/create",
      payload: { filename: "x", extension: "bin" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Reverse share is inactive");
    expect(FileService.prototype.createMultipartUpload).not.toHaveBeenCalled();
  });

  it("returns 410 when the reverse share has expired", async () => {
    const owner = await createUser();
    await createReverseShare(owner.id, {
      alias: "stale",
      expiration: new Date(Date.now() - 60_000),
    });

    const res = await app.inject({
      method: "POST",
      url: "/reverse-shares/alias/stale/multipart/create",
      payload: { filename: "x", extension: "bin" },
    });

    expect(res.statusCode).toBe(410);
    expect(res.json().error).toBe("Reverse share has expired");
    expect(FileService.prototype.createMultipartUpload).not.toHaveBeenCalled();
  });

  it("returns 401 when password required but not provided", async () => {
    const owner = await createUser();
    await createReverseShare(owner.id, { alias: "locked", password: "hunter2" });

    const res = await app.inject({
      method: "POST",
      url: "/reverse-shares/alias/locked/multipart/create",
      payload: { filename: "x", extension: "bin" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Password required");
    expect(FileService.prototype.createMultipartUpload).not.toHaveBeenCalled();
  });

  it("returns 401 when password is wrong", async () => {
    const owner = await createUser();
    await createReverseShare(owner.id, { alias: "locked2", password: "hunter2" });

    const res = await app.inject({
      method: "POST",
      url: "/reverse-shares/alias/locked2/multipart/create?password=wrong",
      payload: { filename: "x", extension: "bin" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Invalid password");
    expect(FileService.prototype.createMultipartUpload).not.toHaveBeenCalled();
  });

  it("accepts the correct password", async () => {
    const owner = await createUser();
    await createReverseShare(owner.id, { alias: "open", password: "hunter2" });

    const res = await app.inject({
      method: "POST",
      url: "/reverse-shares/alias/open/multipart/create?password=hunter2",
      payload: { filename: "x", extension: "bin" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().uploadId).toBe(FAKE_UPLOAD_ID);
  });
});

describe("GET /reverse-shares/alias/:alias/multipart/part-url", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
    stubFileService();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it("returns 200 with a presigned url for a valid request", async () => {
    const owner = await createUser();
    await createReverseShare(owner.id, { alias: "drop" });

    const res = await app.inject({
      method: "GET",
      url: "/reverse-shares/alias/drop/multipart/part-url?uploadId=upid&objectName=reverse-shares/drop/test.bin&partNumber=1",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().url).toBe(FAKE_PRESIGNED_URL);
    expect(FileService.prototype.getPresignedPartUrl).toHaveBeenCalledWith(
      "reverse-shares/drop/test.bin",
      "upid",
      1,
      expect.any(Number)
    );
  });

  it("returns 400 when partNumber is out of range", async () => {
    const owner = await createUser();
    await createReverseShare(owner.id, { alias: "drop" });

    const res = await app.inject({
      method: "GET",
      url: "/reverse-shares/alias/drop/multipart/part-url?uploadId=upid&objectName=x&partNumber=99999",
    });

    expect(res.statusCode).toBe(400);
    expect(FileService.prototype.getPresignedPartUrl).not.toHaveBeenCalled();
  });

  it("rejects requests for an unknown alias with 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/reverse-shares/alias/nope/multipart/part-url?uploadId=upid&objectName=x&partNumber=1",
    });

    expect(res.statusCode).toBe(404);
    expect(FileService.prototype.getPresignedPartUrl).not.toHaveBeenCalled();
  });

  it("rejects requests for an inactive reverse share with 403", async () => {
    const owner = await createUser();
    await createReverseShare(owner.id, { alias: "off", isActive: false });

    const res = await app.inject({
      method: "GET",
      url: "/reverse-shares/alias/off/multipart/part-url?uploadId=upid&objectName=x&partNumber=1",
    });

    expect(res.statusCode).toBe(403);
    expect(FileService.prototype.getPresignedPartUrl).not.toHaveBeenCalled();
  });
});

describe("POST /reverse-shares/alias/:alias/multipart/complete", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
    stubFileService();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it("returns 200 and forwards parts to FileService for a valid request", async () => {
    const owner = await createUser();
    await createReverseShare(owner.id, { alias: "drop" });

    const parts = [
      { PartNumber: 1, ETag: "etag-1" },
      { PartNumber: 2, ETag: "etag-2" },
    ];
    const res = await app.inject({
      method: "POST",
      url: "/reverse-shares/alias/drop/multipart/complete",
      payload: { uploadId: "upid", objectName: "reverse-shares/drop/test.bin", parts },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().objectName).toBe("reverse-shares/drop/test.bin");
    expect(res.json().message).toBe("Multipart upload completed successfully");
    expect(FileService.prototype.completeMultipartUpload).toHaveBeenCalledWith(
      "reverse-shares/drop/test.bin",
      "upid",
      parts
    );
  });

  it("rejects requests for an expired reverse share with 410", async () => {
    const owner = await createUser();
    await createReverseShare(owner.id, {
      alias: "stale",
      expiration: new Date(Date.now() - 60_000),
    });

    const res = await app.inject({
      method: "POST",
      url: "/reverse-shares/alias/stale/multipart/complete",
      payload: { uploadId: "upid", objectName: "x", parts: [{ PartNumber: 1, ETag: "e" }] },
    });

    expect(res.statusCode).toBe(410);
    expect(FileService.prototype.completeMultipartUpload).not.toHaveBeenCalled();
  });

  it("rejects requests with bad password as 401", async () => {
    const owner = await createUser();
    await createReverseShare(owner.id, { alias: "locked", password: "hunter2" });

    const res = await app.inject({
      method: "POST",
      url: "/reverse-shares/alias/locked/multipart/complete?password=wrong",
      payload: { uploadId: "upid", objectName: "x", parts: [{ PartNumber: 1, ETag: "e" }] },
    });

    expect(res.statusCode).toBe(401);
    expect(FileService.prototype.completeMultipartUpload).not.toHaveBeenCalled();
  });
});

describe("POST /reverse-shares/alias/:alias/multipart/abort", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
    stubFileService();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it("returns 200 and forwards to FileService for a valid request", async () => {
    const owner = await createUser();
    await createReverseShare(owner.id, { alias: "drop" });

    const res = await app.inject({
      method: "POST",
      url: "/reverse-shares/alias/drop/multipart/abort",
      payload: { uploadId: "upid", objectName: "reverse-shares/drop/test.bin" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBe("Multipart upload aborted successfully");
    expect(FileService.prototype.abortMultipartUpload).toHaveBeenCalledWith("reverse-shares/drop/test.bin", "upid");
  });

  it("rejects requests for an unknown alias with 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/reverse-shares/alias/missing/multipart/abort",
      payload: { uploadId: "upid", objectName: "x" },
    });

    expect(res.statusCode).toBe(404);
    expect(FileService.prototype.abortMultipartUpload).not.toHaveBeenCalled();
  });

  it("rejects requests for an inactive reverse share with 403", async () => {
    const owner = await createUser();
    await createReverseShare(owner.id, { alias: "off", isActive: false });

    const res = await app.inject({
      method: "POST",
      url: "/reverse-shares/alias/off/multipart/abort",
      payload: { uploadId: "upid", objectName: "x" },
    });

    expect(res.statusCode).toBe(403);
    expect(FileService.prototype.abortMultipartUpload).not.toHaveBeenCalled();
  });
});
