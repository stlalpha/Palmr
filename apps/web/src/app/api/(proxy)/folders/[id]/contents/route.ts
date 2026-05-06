import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyFetch({
    req,
    method: "GET",
    path: `/folders/${id}/contents`,
  });
}
