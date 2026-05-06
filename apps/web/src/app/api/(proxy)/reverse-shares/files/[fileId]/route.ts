import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  return proxyFetch({
    req,
    method: "GET",
    path: `/reverse-shares/files/${fileId}/download`,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  return proxyFetch({
    req,
    method: "PUT",
    path: `/reverse-shares/files/${fileId}`,
    body: await req.text(),
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  return proxyFetch({
    req,
    method: "DELETE",
    path: `/reverse-shares/files/${fileId}`,
  });
}
