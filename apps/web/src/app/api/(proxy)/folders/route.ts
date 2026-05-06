import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function GET(req: NextRequest) {
  const queryString = req.nextUrl.searchParams.toString();
  return proxyFetch({
    req,
    method: "GET",
    path: `/folders${queryString ? `?${queryString}` : ""}`,
  });
}

export async function POST(req: NextRequest) {
  return proxyFetch({
    req,
    method: "POST",
    path: "/folders",
    body: await req.text(),
  });
}
