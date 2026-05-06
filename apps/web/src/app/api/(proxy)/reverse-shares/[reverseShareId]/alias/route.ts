import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function POST(req: NextRequest, { params }: { params: Promise<{ reverseShareId: string }> }) {
  const { reverseShareId } = await params;
  const body = await req.text();
  return proxyFetch({
    req,
    method: "POST",
    path: `/reverse-shares/${reverseShareId}/alias`,
    body,
  });
}
