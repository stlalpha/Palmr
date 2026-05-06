import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function POST(req: NextRequest) {
  return proxyFetch({
    req,
    method: "POST",
    path: "/auth/2fa/verify-setup",
    body: await req.text(),
    extraInboundHeaders: ["authorization"],
  });
}
