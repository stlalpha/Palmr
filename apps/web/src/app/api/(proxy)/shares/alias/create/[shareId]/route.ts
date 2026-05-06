import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function POST(req: NextRequest, { params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const body = await req.text();
  return proxyFetch({
    req,
    method: "POST",
    path: `/shares/${shareId}/alias`,
    body,
  });
}
