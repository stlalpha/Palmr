import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyFetch({
    req,
    method: "PATCH",
    path: `/reverse-shares/${id}/deactivate`,
  });
}
