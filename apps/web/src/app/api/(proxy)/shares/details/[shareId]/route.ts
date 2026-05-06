import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function GET(req: NextRequest, { params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const queryString = req.nextUrl.searchParams.toString();
  return proxyFetch({
    req,
    method: "GET",
    path: `/shares/${shareId}${queryString ? `?${queryString}` : ""}`,
  });
}
