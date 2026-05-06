import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyFetch({
    req: request,
    method: "PUT",
    path: `/auth/providers/${id}`,
    body: await request.text(),
    extraInboundHeaders: ["authorization"],
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyFetch({
    req: request,
    method: "DELETE",
    path: `/auth/providers/${id}`,
    extraInboundHeaders: ["authorization"],
  });
}
