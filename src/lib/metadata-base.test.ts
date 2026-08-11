import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveMetadataBase } from "./metadata-base";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveMetadataBase", () => {
  it("test_an_undeclared_site_url_leaves_metadata_urls_relative", () => {
    expect(resolveMetadataBase(undefined)).toBeUndefined();
  });

  it("test_a_blank_site_url_leaves_metadata_urls_relative", () => {
    expect(resolveMetadataBase("   ")).toBeUndefined();
  });

  it("test_an_https_site_url_becomes_the_metadata_base", () => {
    expect(resolveMetadataBase("https://notes.example.com")?.href).toBe(
      "https://notes.example.com/",
    );
  });

  it("test_a_local_http_site_url_becomes_the_metadata_base", () => {
    expect(resolveMetadataBase(" http://127.0.0.1:3000 ")?.href).toBe("http://127.0.0.1:3000/");
  });

  it("test_a_value_that_is_not_an_absolute_url_is_ignored", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(resolveMetadataBase("notes.example.com")).toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });

  it("test_a_non_http_scheme_is_ignored", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(resolveMetadataBase("javascript:alert(1)")).toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });
});
