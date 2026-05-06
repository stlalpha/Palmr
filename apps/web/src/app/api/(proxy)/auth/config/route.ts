import { proxyFetch } from "@/lib/proxy-fetch";

export async function GET() {
  return proxyFetch({
    method: "GET",
    path: "/auth/config",
    forwardCookie: false,
  });
}
