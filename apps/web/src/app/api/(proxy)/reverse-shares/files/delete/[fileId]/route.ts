import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  return proxyFetch({
    req,
    method: "DELETE",
    path: `/reverse-shares/files/${fileId}`,
  });
}
