/**
 * Cross-origin protection for the local write APIs.
 *
 * These routes edit files on the developer's disk and have no login, so the
 * realistic threat is not a remote attacker (they cannot reach localhost) but
 * *any page the developer visits* while `npm run dev` runs. A browser will send
 * a cross-origin `POST` with no preflight — and therefore actually perform the
 * write — as long as the request stays a CORS "simple request".
 *
 * Two independent checks close that path:
 *
 *  1. Require a JSON content type. `application/json` is not a simple-request
 *     content type, so the browser must preflight; Next answers no CORS headers,
 *     so the real request is never sent.
 *  2. Reject requests the browser labels cross-origin, via `Sec-Fetch-Site`
 *     (with an `Origin`/`Host` comparison as the fallback).
 *
 * The default server commands bind to loopback, and this guard independently
 * requires a loopback request target. The second check keeps hosted deployments
 * read-only even when a reverse proxy makes the application reachable.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** `application/json`, plus `+json` suffixed types, with optional parameters. */
const JSON_CONTENT_TYPE = /^application\/(?:[\w.+-]+\+)?json\s*(?:;.*)?$/i;

/**
 * Guard a state-changing request. Returns a response to send back when the
 * request must be refused, or null when it is safe to proceed.
 */
export function rejectCrossOriginWrite(request: NextRequest): NextResponse | null {
  if (!JSON_CONTENT_TYPE.test(request.headers.get("content-type")?.trim() ?? "")) {
    return NextResponse.json(
      { message: "This endpoint requires a JSON request body." },
      { status: 415 },
    );
  }

  if (!isLoopbackHostname(request.nextUrl.hostname)) {
    return NextResponse.json(
      { message: "Authoring is available only on this device." },
      { status: 403 },
    );
  }

  if (isCrossOrigin(request)) {
    return NextResponse.json({ message: "Cross-origin writes are not allowed." }, { status: 403 });
  }

  return null;
}

export function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

function isCrossOrigin(request: NextRequest): boolean {
  // Set by every current browser. "none" is a direct navigation or typed URL.
  const fetchSite = request.headers.get("sec-fetch-site");

  if (fetchSite) {
    return fetchSite !== "same-origin" && fetchSite !== "none";
  }

  const origin = request.headers.get("origin");

  if (!origin) {
    return false; // Not a browser-initiated request.
  }

  try {
    return new URL(origin).host !== request.headers.get("host");
  } catch {
    return true; // Unparseable Origin — treat as hostile.
  }
}
