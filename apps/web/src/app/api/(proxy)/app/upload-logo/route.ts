import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export const maxDuration = 300; // 5 minutes for logo uploads
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  return proxyFetch({
    req,
    method: "POST",
    path: "/app/logo",
    body: formData,
  });
}
