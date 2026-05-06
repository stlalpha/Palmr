import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function GET(req: NextRequest) {
  return proxyFetch({
    req,
    method: "GET",
    path: `/app/configs`,
  });
}
