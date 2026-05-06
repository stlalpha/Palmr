import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function GET(req: NextRequest) {
  return proxyFetch({
    req,
    method: "GET",
    path: "/auth/trusted-devices",
    forwardClientHeaders: true,
    extraInboundHeaders: ["authorization"],
  });
}

export async function DELETE(req: NextRequest) {
  return proxyFetch({
    req,
    method: "DELETE",
    path: "/auth/trusted-devices",
    forwardClientHeaders: true,
    extraInboundHeaders: ["authorization"],
  });
}
