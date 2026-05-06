import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function GET(req: NextRequest, { params }: { params: Promise<{ alias: string }> }) {
  const { alias } = await params;
  const queryString = req.nextUrl.searchParams.toString();
  return proxyFetch({
    req,
    method: "GET",
    path: `/reverse-shares/alias/${alias}/upload${queryString ? `?${queryString}` : ""}`,
  });
}
