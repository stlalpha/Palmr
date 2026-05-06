import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formData = await req.formData();
  return proxyFetch({
    req,
    method: "PATCH",
    path: `/users/${id}/avatar`,
    body: formData,
  });
}
