import { NextRequest } from "next/server";

import { proxyFetch } from "@/lib/proxy-fetch";

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(request.url);
  const queryString = url.search;
  const originalHost = request.headers.get("host") || url.host;
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const originalProtocol = forwardedProto ? forwardedProto.split(",")[0].trim() : url.protocol.replace(":", "");

  return proxyFetch({
    req: request,
    method: "GET",
    path: `/auth/providers/${provider}/callback${queryString}`,
    convertRedirects: true,
    extraInboundHeaders: ["authorization"],
    extraOutboundHeaders: {
      "x-forwarded-host": originalHost,
      "x-forwarded-proto": originalProtocol,
    },
  });
}
