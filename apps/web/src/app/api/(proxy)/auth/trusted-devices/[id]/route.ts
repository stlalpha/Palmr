import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyFetch({
    req: request,
    method: "DELETE",
    path: `/auth/trusted-devices/${id}`,
    forwardClientHeaders: true,
    extraInboundHeaders: ["authorization"],
  });
}
