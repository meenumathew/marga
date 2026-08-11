import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { isLoopbackHostname, rejectCrossOriginWrite } from "./request-guard";

/** Minimal stand-in: the guard only reads headers. */
function requestWith(
  headers: Record<string, string>,
  url = "http://localhost/api/content",
): NextRequest {
  return { headers: new Headers(headers), nextUrl: new URL(url) } as unknown as NextRequest;
}

const JSON_TYPE = { "content-type": "application/json" };

describe("rejectCrossOriginWrite", () => {
  it.each(["localhost", "127.0.0.1", "::1", "[::1]"])(
    "test_loopback_target_is_recognized: %s",
    (hostname) => {
      expect(isLoopbackHostname(hostname)).toBe(true);
    },
  );

  it.each(["marga.example", "192.168.1.10", "0.0.0.0", "localhost.example"])(
    "test_non_loopback_target_is_rejected: %s",
    (hostname) => {
      expect(isLoopbackHostname(hostname)).toBe(false);
    },
  );

  it("allows a same-origin JSON write from the app itself", () => {
    const request = requestWith({
      ...JSON_TYPE,
      "sec-fetch-site": "same-origin",
      host: "localhost:3000",
      origin: "http://localhost:3000",
    });

    expect(rejectCrossOriginWrite(request)).toBeNull();
  });

  it("refuses the CSRF-shaped simple request (text/plain)", () => {
    const request = requestWith({ "content-type": "text/plain" });
    expect(rejectCrossOriginWrite(request)?.status).toBe(415);
  });

  it("refuses form content types, which also skip preflight", () => {
    for (const type of ["application/x-www-form-urlencoded", "multipart/form-data"]) {
      expect(rejectCrossOriginWrite(requestWith({ "content-type": type }))?.status).toBe(415);
    }
  });

  it("refuses a missing content type", () => {
    expect(rejectCrossOriginWrite(requestWith({}))?.status).toBe(415);
  });

  it("refuses a cross-site request even when it claims JSON", () => {
    const request = requestWith({ ...JSON_TYPE, "sec-fetch-site": "cross-site" });
    expect(rejectCrossOriginWrite(request)?.status).toBe(403);
  });

  it("refuses a same-site request from another subdomain", () => {
    const request = requestWith({ ...JSON_TYPE, "sec-fetch-site": "same-site" });
    expect(rejectCrossOriginWrite(request)?.status).toBe(403);
  });

  it("falls back to Origin vs Host when Sec-Fetch-Site is absent", () => {
    const crossOrigin = requestWith({
      ...JSON_TYPE,
      origin: "https://evil.example",
      host: "localhost:3000",
    });
    expect(rejectCrossOriginWrite(crossOrigin)?.status).toBe(403);

    const sameOrigin = requestWith({
      ...JSON_TYPE,
      origin: "http://localhost:3000",
      host: "localhost:3000",
    });
    expect(rejectCrossOriginWrite(sameOrigin)).toBeNull();
  });

  it("treats an unparseable Origin as hostile", () => {
    const request = requestWith({ ...JSON_TYPE, origin: "not a url", host: "localhost:3000" });
    expect(rejectCrossOriginWrite(request)?.status).toBe(403);
  });

  it("allows non-browser callers that send no origin hints", () => {
    expect(rejectCrossOriginWrite(requestWith(JSON_TYPE))).toBeNull();
  });

  it("accepts a charset parameter and +json suffixes", () => {
    expect(
      rejectCrossOriginWrite(requestWith({ "content-type": "application/json; charset=utf-8" })),
    ).toBeNull();
    expect(
      rejectCrossOriginWrite(requestWith({ "content-type": "application/merge-patch+json" })),
    ).toBeNull();
  });

  it("allows a direct navigation (sec-fetch-site: none)", () => {
    const request = requestWith({ ...JSON_TYPE, "sec-fetch-site": "none" });
    expect(rejectCrossOriginWrite(request)).toBeNull();
  });
});
