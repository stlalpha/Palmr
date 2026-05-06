import { prisma } from "../../src/shared/prisma";

export async function resetDb() {
  await prisma.shareRecipient.deleteMany();
  await prisma.shareAlias.deleteMany();
  await prisma.reverseShareAlias.deleteMany();
  await prisma.reverseShareFile.deleteMany();
  await prisma.share.deleteMany();
  await prisma.shareSecurity.deleteMany();
  await prisma.reverseShare.deleteMany();
  await prisma.file.deleteMany();
  await prisma.folder.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.userAuthProvider.deleteMany();
  await prisma.trustedDevice.deleteMany();
  await prisma.user.deleteMany();
}
