import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../src/shared/prisma";
import { authHeader, createFile, createShare, createUser } from "../helpers/factories";
import { buildTestApp } from "../helpers/test-app";

describe("GET /shares/:shareId access control", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns the share for an anonymous viewer when no protections are set", async () => {
    const owner = await createUser();
    const file = await createFile(owner.id);
    const share = await createShare(owner.id, { fileIds: [file.id] });

    const res = await app.inject({ method: "GET", url: `/shares/${share.id}` });

    expect(res.statusCode).toBe(200);
    expect(res.json().share.id).toBe(share.id);
  });

  it("returns 404 for an unknown share id", async () => {
    const res = await app.inject({ method: "GET", url: "/shares/cltestnonexistent" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Share not found");
  });

  it("returns 410 when the share is expired", async () => {
    const owner = await createUser();
    const file = await createFile(owner.id);
    const share = await createShare(owner.id, {
      fileIds: [file.id],
      expiration: new Date(Date.now() - 60_000),
    });

    const res = await app.inject({ method: "GET", url: `/shares/${share.id}` });

    expect(res.statusCode).toBe(410);
    expect(res.json().error).toBe("Share has expired");
  });

  it("returns 403 when max views has been reached", async () => {
    const owner = await createUser();
    const file = await createFile(owner.id);
    const share = await createShare(owner.id, { fileIds: [file.id], maxViews: 1 });

    const first = await app.inject({ method: "GET", url: `/shares/${share.id}` });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({ method: "GET", url: `/shares/${share.id}` });
    expect(second.statusCode).toBe(403);
    expect(second.json().error).toBe("Share has reached maximum views");
  });

  it("rejects access when password is set and not provided", async () => {
    const owner = await createUser();
    const file = await createFile(owner.id);
    const share = await createShare(owner.id, { fileIds: [file.id], password: "hunter2" });

    const res = await app.inject({ method: "GET", url: `/shares/${share.id}` });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Password required");
  });

  it("rejects access when the password is wrong", async () => {
    const owner = await createUser();
    const file = await createFile(owner.id);
    const share = await createShare(owner.id, { fileIds: [file.id], password: "hunter2" });

    const res = await app.inject({
      method: "GET",
      url: `/shares/${share.id}?password=wrong`,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Invalid password");
  });

  it("grants access when the correct password is provided", async () => {
    const owner = await createUser();
    const file = await createFile(owner.id);
    const share = await createShare(owner.id, { fileIds: [file.id], password: "hunter2" });

    const res = await app.inject({
      method: "GET",
      url: `/shares/${share.id}?password=hunter2`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().share.id).toBe(share.id);
  });

  it("increments view count on successful access", async () => {
    const owner = await createUser();
    const file = await createFile(owner.id);
    const share = await createShare(owner.id, { fileIds: [file.id] });

    await app.inject({ method: "GET", url: `/shares/${share.id}` });
    await app.inject({ method: "GET", url: `/shares/${share.id}` });

    const refreshed = await prisma.share.findUnique({ where: { id: share.id } });
    expect(refreshed?.views).toBe(2);
  });

  it("does not increment views when access is denied (expired)", async () => {
    const owner = await createUser();
    const file = await createFile(owner.id);
    const share = await createShare(owner.id, {
      fileIds: [file.id],
      expiration: new Date(Date.now() - 60_000),
    });

    await app.inject({ method: "GET", url: `/shares/${share.id}` });

    const refreshed = await prisma.share.findUnique({ where: { id: share.id } });
    expect(refreshed?.views).toBe(0);
  });

  it("does not increment views when password is wrong", async () => {
    const owner = await createUser();
    const file = await createFile(owner.id);
    const share = await createShare(owner.id, { fileIds: [file.id], password: "hunter2" });

    await app.inject({ method: "GET", url: `/shares/${share.id}?password=wrong` });

    const refreshed = await prisma.share.findUnique({ where: { id: share.id } });
    expect(refreshed?.views).toBe(0);
  });

  it("lets the creator bypass expiration when authenticated", async () => {
    const owner = await createUser();
    const file = await createFile(owner.id);
    const share = await createShare(owner.id, {
      fileIds: [file.id],
      expiration: new Date(Date.now() - 60_000),
    });

    const res = await app.inject({
      method: "GET",
      url: `/shares/${share.id}`,
      headers: authHeader(app, owner.id),
    });

    expect(res.statusCode).toBe(200);
  });

  it("lets the creator bypass max-views and password without consuming a view", async () => {
    const owner = await createUser();
    const file = await createFile(owner.id);
    const share = await createShare(owner.id, {
      fileIds: [file.id],
      password: "hunter2",
      maxViews: 0,
    });

    const res = await app.inject({
      method: "GET",
      url: `/shares/${share.id}`,
      headers: authHeader(app, owner.id),
    });

    expect(res.statusCode).toBe(200);
    const refreshed = await prisma.share.findUnique({ where: { id: share.id } });
    expect(refreshed?.views).toBe(0);
  });

  it("does NOT bypass for a non-creator authenticated user", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const file = await createFile(owner.id);
    const share = await createShare(owner.id, { fileIds: [file.id], password: "hunter2" });

    const res = await app.inject({
      method: "GET",
      url: `/shares/${share.id}`,
      headers: authHeader(app, intruder.id),
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Password required");
  });
});

describe("GET /shares/alias/:alias", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("resolves alias to share", async () => {
    const owner = await createUser();
    const file = await createFile(owner.id);
    const share = await createShare(owner.id, { fileIds: [file.id], alias: "mystuff" });

    const res = await app.inject({ method: "GET", url: `/shares/alias/mystuff` });

    expect(res.statusCode).toBe(200);
    expect(res.json().share.id).toBe(share.id);
  });

  it("returns 404 for an unknown alias", async () => {
    const res = await app.inject({ method: "GET", url: "/shares/alias/doesnotexist" });
    expect(res.statusCode).toBe(404);
  });

  it("enforces password protection via alias", async () => {
    const owner = await createUser();
    const file = await createFile(owner.id);
    await createShare(owner.id, { fileIds: [file.id], alias: "locked", password: "hunter2" });

    const res = await app.inject({ method: "GET", url: "/shares/alias/locked" });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Password required");
  });
});

describe("GET /shares/alias/:alias/metadata", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns metadata flags without enforcing access", async () => {
    const owner = await createUser();
    const file = await createFile(owner.id);
    await createShare(owner.id, {
      fileIds: [file.id],
      alias: "meta",
      password: "hunter2",
      maxViews: 5,
      expiration: new Date(Date.now() + 60_000),
      name: "My Share",
    });

    const res = await app.inject({ method: "GET", url: "/shares/alias/meta/metadata" });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe("My Share");
    expect(body.hasPassword).toBe(true);
    expect(body.totalFiles).toBe(1);
    expect(body.isExpired).toBe(false);
    expect(body.isMaxViewsReached).toBe(false);
  });

  it("reports expired correctly", async () => {
    const owner = await createUser();
    const file = await createFile(owner.id);
    await createShare(owner.id, {
      fileIds: [file.id],
      alias: "expired",
      expiration: new Date(Date.now() - 60_000),
    });

    const res = await app.inject({ method: "GET", url: "/shares/alias/expired/metadata" });

    expect(res.statusCode).toBe(200);
    expect(res.json().isExpired).toBe(true);
  });
});

describe("DELETE /shares/:id auth", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 401 with no auth header (and does not delete)", async () => {
    const owner = await createUser();
    const file = await createFile(owner.id);
    const share = await createShare(owner.id, { fileIds: [file.id] });

    const res = await app.inject({ method: "DELETE", url: `/shares/${share.id}` });

    expect(res.statusCode).toBe(401);

    const stillExists = await prisma.share.findUnique({ where: { id: share.id } });
    expect(stillExists).not.toBeNull();
  });

  it("returns 404 for an unknown share id", async () => {
    const owner = await createUser();

    const res = await app.inject({
      method: "DELETE",
      url: "/shares/cltestnonexistent",
      headers: authHeader(app, owner.id),
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Share not found");
  });

  it("returns 401 for non-creator", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const file = await createFile(owner.id);
    const share = await createShare(owner.id, { fileIds: [file.id] });

    const res = await app.inject({
      method: "DELETE",
      url: `/shares/${share.id}`,
      headers: authHeader(app, intruder.id),
    });
    expect(res.statusCode).toBe(401);

    const stillExists = await prisma.share.findUnique({ where: { id: share.id } });
    expect(stillExists).not.toBeNull();
  });

  it("lets the creator delete their share", async () => {
    const owner = await createUser();
    const file = await createFile(owner.id);
    const share = await createShare(owner.id, { fileIds: [file.id] });

    const res = await app.inject({
      method: "DELETE",
      url: `/shares/${share.id}`,
      headers: authHeader(app, owner.id),
    });
    expect(res.statusCode).toBe(200);

    const gone = await prisma.share.findUnique({ where: { id: share.id } });
    expect(gone).toBeNull();
  });
});
