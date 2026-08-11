import { afterEach, describe, expect, it, vi } from "vitest";
import { logRouteError } from "./log";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logRouteError", () => {
  it("test_route_error_names_the_operation_and_keeps_the_cause", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const cause = new Error("EACCES: permission denied");

    logRouteError("DELETE /api/sections", cause);

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]?.[0]).toContain("DELETE /api/sections");
    expect(consoleError.mock.calls[0]?.[1]).toBe(cause);
  });

  it("test_route_error_wraps_a_thrown_non_error", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logRouteError("POST /api/content", "not an error object");

    expect(consoleError.mock.calls[0]?.[1]).toEqual({ thrown: "not an error object" });
  });
});
