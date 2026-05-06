import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyFetch({
    req,
    method: "GET",
    path: `/folders/${id}`,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.text();
  return proxyFetch({
    req,
    method: "PATCH",
    path: `/folders/${id}`,
    body,
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyFetch({
    req,
    method: "DELETE",
    path: `/folders/${id}`,
  });
}
