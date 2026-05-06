import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export const maxDuration = 300; // 5 minutes for avatar uploads
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  return proxyFetch({
    req,
    method: "POST",
    path: "/users/avatar",
    body: formData,
  });
}
