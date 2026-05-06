import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ alias: string }> }) {
  const { alias } = await params;
  const queryString = req.nextUrl.searchParams.toString();
  return proxyFetch({
    req,
    method: "POST",
    path: `/reverse-shares/alias/${alias}/register-file${queryString ? `?${queryString}` : ""}`,
    body: await req.text(),
  });
}
