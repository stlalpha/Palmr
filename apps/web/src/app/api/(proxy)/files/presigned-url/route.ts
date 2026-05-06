import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function GET(req: NextRequest) {
  const queryString = req.nextUrl.searchParams.toString();
  return proxyFetch({
    req,
    method: "GET",
    path: `/files/presigned-url${queryString ? `?${queryString}` : ""}`,
  });
}
