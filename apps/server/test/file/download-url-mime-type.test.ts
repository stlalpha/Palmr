import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { S3StorageProvider } from "../../src/providers/s3-storage.provider";
import { prisma } from "../../src/shared/prisma";
import { getContentType } from "../../src/utils/mime-types";
import { authHeader, createFile, createShare, createUser } from "../helpers/factories";
import { buildTestApp } from "../helpers/test-app";

/**
 * Regression coverage for the audio-preview MIME-type bug originally reported as
 * kyantech/Palmr#236. The legacy filesystem provider didn't preserve fileName for
 * MIME detection; the storage refactor (v3.2.x → v3.3.0-beta) replaced it with an
 * S3-only path that DOES propagate fileName via ResponseContentType. These tests
 * pin the server-side wiring so a future refactor can't silently regress it.
 */

const FAKE_PRESIGNED_URL = "https://example.test/presigned/get";

function stubS3GetUrl() {
  return vi.spyOn(S3StorageProvider.prototype, "getPresignedGetUrl").mockResolvedValue(FAKE_PRESIGNED_URL);
}

describe("GET /files/download-url passes filename with extension to S3", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it("forwards full filename (with extension) so S3 sets audio/mpeg ResponseContentType", async () => {
    const spy = stubS3GetUrl();

    const owner = await createUser();
    // Files are stored with name = `${baseName}.${extension}` (see generateUniqueFileName).
    const file = await createFile(owner.id, { name: "song.mp3", extension: "mp3" });
    await createShare(owner.id, { fileIds: [file.id] });

    const res = await app.inject({
      method: "GET",
      url: `/files/download-url?objectName=${encodeURIComponent(file.objectName)}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().url).toBe(FAKE_PRESIGNED_URL);

    expect(spy).toHaveBeenCalledOnce();
    const [objectNameArg, , fileNameArg] = spy.mock.calls[0];
    expect(objectNameArg).toBe(file.objectName);
    // The third argument is what feeds getContentType in the provider; it MUST
    // include the extension or the audio preview falls back to octet-stream.
    expect(fileNameArg).toBe("song.mp3");
    expect(getContentType(fileNameArg as string)).toBe("audio/mpeg");
  });

  it("works for an authenticated owner with no share involvement", async () => {
    const spy = stubS3GetUrl();

    const owner = await createUser();
    const file = await createFile(owner.id, { name: "track.flac", extension: "flac" });

    const res = await app.inject({
      method: "GET",
      url: `/files/download-url?objectName=${encodeURIComponent(file.objectName)}`,
      headers: authHeader(app, owner.id),
    });

    expect(res.statusCode).toBe(200);
    const [, , fileNameArg] = spy.mock.calls[0];
    expect(fileNameArg).toBe("track.flac");
    expect(getContentType(fileNameArg as string)).toBe("audio/flac");
  });

  it("returns 401 when the file is in no shares and the requester is anonymous", async () => {
    const spy = stubS3GetUrl();

    const owner = await createUser();
    const file = await createFile(owner.id, { name: "private.mp3", extension: "mp3" });

    const res = await app.inject({
      method: "GET",
      url: `/files/download-url?objectName=${encodeURIComponent(file.objectName)}`,
    });

    expect(res.statusCode).toBe(401);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown objectName", async () => {
    stubS3GetUrl();

    const res = await app.inject({
      method: "GET",
      url: `/files/download-url?objectName=does-not-exist`,
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("file registration stores name with extension", () => {
  /**
   * The MIME type detection only works because file.name in the DB includes
   * the extension. If a future refactor changes the registration to store
   * just the base name, this test fails fast.
   */
  it("registered file's name field includes the extension", async () => {
    const owner = await createUser();
    const file = await createFile(owner.id, { name: "voicenote.m4a", extension: "m4a" });

    const stored = await prisma.file.findUniqueOrThrow({ where: { id: file.id } });
    expect(stored.name).toBe("voicenote.m4a");
    expect(stored.extension).toBe("m4a");
    expect(getContentType(stored.name)).toBe("audio/mp4");
  });
});

describe("getContentType resolves common audio extensions correctly", () => {
  it.each([
    ["song.mp3", "audio/mpeg"],
    ["voice.m4a", "audio/mp4"],
    ["track.flac", "audio/flac"],
    ["jingle.wav", "audio/wav"],
    ["podcast.ogg", "audio/ogg"],
    ["clip.opus", "audio/opus"],
    ["unknown-extension.zzz", "application/octet-stream"],
    ["no-extension", "application/octet-stream"],
  ])("getContentType(%s) → %s", (fileName, expected) => {
    expect(getContentType(fileName)).toBe(expected);
  });
});
