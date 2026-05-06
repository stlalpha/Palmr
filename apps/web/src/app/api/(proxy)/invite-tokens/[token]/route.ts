import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return proxyFetch({
    req,
    method: "GET",
    path: `/invite-tokens/${token}`,
  });
}
