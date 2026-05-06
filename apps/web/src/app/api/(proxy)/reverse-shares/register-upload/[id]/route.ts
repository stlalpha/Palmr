import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const queryString = req.nextUrl.searchParams.toString();
  return proxyFetch({
    req,
    method: "POST",
    path: `/reverse-shares/${id}/register-file${queryString ? `?${queryString}` : ""}`,
    body: await req.text(),
  });
}
