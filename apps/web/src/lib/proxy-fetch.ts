import { NextRequest, NextResponse } from "next/server";

import { getClientHeaders } from "./proxy-utils";

/**
 * Centralised proxy implementation for `(proxy)` route handlers. Replaces
 * ~105 hand-rolled fetch calls that each:
 *   - had no try/catch around fetch (network errors → generic 500)
 *   - hardcoded `Content-Type: application/json` on the response (broke
 *     any endpoint that returned non-JSON)
 *   - duplicated cookie / Set-Cookie forwarding logic
 *
 * Use this from every (proxy)/**\/route.ts. New proxy routes must use it.
 *
 * @see issue #6
 */

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3333";

export interface ProxyFetchOptions {
  /** Path on the upstream API server (API_BASE_URL is prepended). */
  path: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** The inbound NextRequest. Used for cookie forwarding and (optionally)
   *  client-IP / user-agent / extra header forwarding. */
  req?: NextRequest;
  /** Request body. String/Buffer/FormData/null/undefined.
   *
   *  - `FormData`: Content-Type is left unset so `fetch` sets the multipart
   *    boundary itself.
   *  - String/Buffer: defaults to `application/json` unless `bodyContentType`
   *    is provided (or set to `null` to suppress).
   *  - `null`/`undefined`: no body, no Content-Type. */
  body?: BodyInit | null;
  /** Override Content-Type. Pass `null` to omit explicitly. */
  bodyContentType?: string | null;
  /** Forward `X-Real-IP` and `X-User-Agent` headers. Used by login flows.
   *  Defaults to `false`. */
  forwardClientHeaders?: boolean;
  /** Forward the inbound `cookie` header. Defaults to `true` when `req`
   *  is provided. Pass `false` for routes that talk to the API without
   *  a session (e.g. public health checks). */
  forwardCookie?: boolean;
  /** Forward the upstream's `Set-Cookie` headers to the browser. Defaults
   *  to `true`. */
  forwardSetCookie?: boolean;
  /** Stream the upstream response body straight through, preserving
   *  Content-Type, Content-Disposition, Content-Length, and Cache-Control.
   *  Use for binary downloads (zip, file content, images). When `false`
   *  (default), the upstream's content-type is still passed through but
   *  the body is buffered as text — fine for JSON/text responses. */
  streamResponse?: boolean;
  /** Additional inbound request header names to forward upstream verbatim.
   *  Lower-case header names. Used by routes that need to pass along
   *  Authorization, Accept, X-Forwarded-* headers etc. */
  extraInboundHeaders?: readonly string[];
  /** Additional headers to send upstream as literal values (not pulled from
   *  the inbound request). Used when the route needs to compute a header
   *  value (e.g. canonicalising x-forwarded-proto). Values here override
   *  any auto-derived header of the same name. */
  extraOutboundHeaders?: Record<string, string>;
  /** When the upstream returns a 3xx, convert it to a `NextResponse.redirect`
   *  pointing at the upstream's `Location` header. Use for OAuth flows where
   *  the browser needs to follow the redirect rather than receive a 3xx with
   *  a JSON body. Default: false. */
  convertRedirects?: boolean;
}

const STREAM_RESPONSE_HEADERS: Array<[lower: string, output: string]> = [
  ["content-disposition", "Content-Disposition"],
  ["content-length", "Content-Length"],
  ["cache-control", "Cache-Control"],
  ["accept-ranges", "Accept-Ranges"],
  ["content-range", "Content-Range"],
];

export async function proxyFetch(opts: ProxyFetchOptions): Promise<NextResponse> {
  const url = `${API_BASE_URL}${opts.path}`;
  const headers: Record<string, string> = {};

  const isFormData = typeof FormData !== "undefined" && opts.body instanceof FormData;
  if (opts.bodyContentType !== undefined) {
    if (opts.bodyContentType !== null) headers["Content-Type"] = opts.bodyContentType;
  } else if (opts.body != null && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (opts.req) {
    if (opts.forwardCookie !== false) {
      const cookie = opts.req.headers.get("cookie");
      if (cookie) headers.cookie = cookie;
    }
    if (opts.forwardClientHeaders) {
      Object.assign(headers, getClientHeaders(opts.req));
    }
    if (opts.extraInboundHeaders) {
      for (const name of opts.extraInboundHeaders) {
        const value = opts.req.headers.get(name);
        if (value) headers[name] = value;
      }
    }
  }

  if (opts.extraOutboundHeaders) {
    Object.assign(headers, opts.extraOutboundHeaders);
  }

  let apiRes: Response;
  try {
    apiRes = await fetch(url, {
      method: opts.method,
      headers,
      body: opts.body ?? undefined,
      redirect: "manual",
    });
  } catch {
    // Network error, DNS failure, upstream connection refused, etc.
    // Return 502 with a JSON error body — the previous unguarded pattern
    // produced a generic Next.js 500 with no signal.
    return NextResponse.json({ error: "Upstream API unavailable" }, { status: 502 });
  }

  if (opts.convertRedirects && apiRes.status >= 300 && apiRes.status < 400) {
    const location = apiRes.headers.get("location");
    if (location) {
      const redirectRes = NextResponse.redirect(location);
      // Preserve Set-Cookie on the redirect (OAuth callbacks set the JWT
      // cookie alongside the redirect to the post-login page).
      if (opts.forwardSetCookie !== false) {
        const setCookies = apiRes.headers.getSetCookie?.() ?? [];
        for (const cookie of setCookies) {
          redirectRes.headers.append("Set-Cookie", cookie);
        }
      }
      return redirectRes;
    }
  }

  let res: NextResponse;
  if (opts.streamResponse) {
    const responseHeaders: Record<string, string> = {
      "Content-Type": apiRes.headers.get("content-type") ?? "application/octet-stream",
    };
    for (const [lower, output] of STREAM_RESPONSE_HEADERS) {
      const value = apiRes.headers.get(lower);
      if (value) responseHeaders[output] = value;
    }
    res = new NextResponse(apiRes.body, { status: apiRes.status, headers: responseHeaders });
  } else {
    const text = await apiRes.text();
    const upstreamContentType = apiRes.headers.get("content-type") ?? "application/json";
    res = new NextResponse(text, {
      status: apiRes.status,
      headers: { "Content-Type": upstreamContentType },
    });
  }

  if (opts.forwardSetCookie !== false) {
    const setCookies = apiRes.headers.getSetCookie?.() ?? [];
    for (const cookie of setCookies) {
      // Use append, not the comma-join that previous routes used —
      // cookies can contain commas in their `expires` attribute and
      // the comma-join produces malformed Set-Cookie headers.
      res.headers.append("Set-Cookie", cookie);
    }
  }

  return res;
}
