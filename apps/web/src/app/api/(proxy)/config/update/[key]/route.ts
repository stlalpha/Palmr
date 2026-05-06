import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const body = await req.text();
  return proxyFetch({
    req,
    method: "PATCH",
    path: `/app/configs/${key}`,
    body,
  });
}
