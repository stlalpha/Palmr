import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function GET(req: NextRequest) {
  const queryString = req.nextUrl.searchParams.toString();
  return proxyFetch({
    req,
    method: "GET",
    path: `/files/download${queryString ? `?${queryString}` : ""}`,
    streamResponse: true,
    extraInboundHeaders: [
      "authorization",
      "user-agent",
      "accept",
      "x-forwarded-for",
      "x-forwarded-proto",
      "x-forwarded-host",
    ],
  });
}
