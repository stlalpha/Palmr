import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  return proxyFetch({
    req,
    method: "GET",
    path: `/reverse-shares/files/${fileId}/download`,
    streamResponse: true,
  });
}
