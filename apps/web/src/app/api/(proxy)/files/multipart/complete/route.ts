import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function POST(req: NextRequest) {
  const body = await req.text();
  return proxyFetch({
    req,
    method: "POST",
    path: `/files/multipart/complete`,
    body,
  });
}
