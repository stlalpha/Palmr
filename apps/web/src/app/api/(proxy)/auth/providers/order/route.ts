import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function PUT(request: NextRequest) {
  return proxyFetch({
    req: request,
    method: "PUT",
    path: "/auth/providers/order",
    body: await request.text(),
    extraInboundHeaders: ["authorization"],
  });
}
