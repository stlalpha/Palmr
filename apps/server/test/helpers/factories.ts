import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";

import { prisma } from "../../src/shared/prisma";

let userCounter = 0;
let fileCounter = 0;

export async function createUser(
  overrides: Partial<{ email: string; username: string; password: string; isAdmin: boolean }> = {}
) {
  userCounter++;
  return prisma.user.create({
    data: {
      firstName: "Test",
      lastName: `User${userCounter}`,
      username: overrides.username ?? `user${userCounter}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      email: overrides.email ?? `user${userCounter}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.local`,
      password: overrides.password ? await bcrypt.hash(overrides.password, 4) : null,
      isAdmin: overrides.isAdmin ?? false,
    },
  });
}

export async function createFile(
  userId: string,
  overrides: Partial<{ name: string; extension: string; size: bigint; folderId: string }> = {}
) {
  fileCounter++;
  return prisma.file.create({
    data: {
      name: overrides.name ?? `file-${fileCounter}`,
      extension: overrides.extension ?? "txt",
      size: overrides.size ?? BigInt(1024),
      objectName: `obj-${fileCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      folderId: overrides.folderId,
    },
  });
}

let folderCounter = 0;
export async function createFolder(userId: string, overrides: Partial<{ name: string; parentId: string }> = {}) {
  folderCounter++;
  return prisma.folder.create({
    data: {
      name: overrides.name ?? `folder-${folderCounter}`,
      objectName: `folder-obj-${folderCounter}-${Date.now()}`,
      userId,
      parentId: overrides.parentId,
    },
  });
}

export async function createShare(
  creatorId: string,
  opts: {
    fileIds?: string[];
    password?: string;
    maxViews?: number;
    expiration?: Date;
    name?: string;
    alias?: string;
  } = {}
) {
  const security = await prisma.shareSecurity.create({
    data: {
      password: opts.password ? await bcrypt.hash(opts.password, 4) : null,
      maxViews: opts.maxViews ?? null,
    },
  });
  const share = await prisma.share.create({
    data: {
      name: opts.name ?? null,
      expiration: opts.expiration ?? null,
      creatorId,
      securityId: security.id,
      files: opts.fileIds && opts.fileIds.length > 0 ? { connect: opts.fileIds.map((id) => ({ id })) } : undefined,
    },
  });
  if (opts.alias) {
    await prisma.shareAlias.create({
      data: { alias: opts.alias, shareId: share.id },
    });
  }
  return share;
}

export function authHeader(app: FastifyInstance, userId: string) {
  const token = app.jwt.sign({ userId });
  return { authorization: `Bearer ${token}` };
}

export async function createReverseShare(
  creatorId: string,
  opts: {
    alias: string;
    password?: string;
    expiration?: Date;
    isActive?: boolean;
    name?: string;
    maxFiles?: number;
  }
) {
  const reverseShare = await prisma.reverseShare.create({
    data: {
      name: opts.name ?? null,
      creatorId,
      password: opts.password ? await bcrypt.hash(opts.password, 4) : null,
      expiration: opts.expiration ?? null,
      isActive: opts.isActive ?? true,
      maxFiles: opts.maxFiles ?? null,
    },
  });
  await prisma.reverseShareAlias.create({
    data: { alias: opts.alias, reverseShareId: reverseShare.id },
  });
  return reverseShare;
}
