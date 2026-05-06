import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function PUT(req: NextRequest) {
  const body = await req.text();
  return proxyFetch({
    req,
    method: "PUT",
    path: `/reverse-shares`,
    body,
  });
}
