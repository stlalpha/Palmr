import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function GET(request: NextRequest) {
  return proxyFetch({
    req: request,
    method: "GET",
    path: "/auth/providers/all",
    extraInboundHeaders: ["authorization"],
  });
}
