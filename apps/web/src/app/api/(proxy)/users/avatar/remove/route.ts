import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function DELETE(req: NextRequest) {
  return proxyFetch({
    req,
    method: "DELETE",
    path: `/users/avatar`,
  });
}
