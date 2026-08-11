import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildThemeOverridesCss } from "./site";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildThemeOverridesCss", () => {
  it("test_no_overrides_produce_no_css", () => {
    expect(buildThemeOverridesCss({ light: {}, dark: {} })).toBe("");
  });

  it("test_each_scheme_gets_its_own_selector", () => {
    const css = buildThemeOverridesCss({
      light: { "--gold": "#0f7f95" },
      dark: { "--gold-2": "#22d3ee" },
    });

    expect(css).toContain(":root{--gold:#0f7f95;}");
    expect(css).toContain('[data-theme="dark"]{--gold-2:#22d3ee;}');
  });

  it("test_colour_and_shadow_values_are_kept", () => {
    const css = buildThemeOverridesCss({
      light: {
        "--accent": "oklch(0.72 0.15 250)",
        "--shadow": "0 1px 2px rgba(0, 0, 0, 0.2)",
        "--ink": "var(--gold)",
      },
      dark: {},
    });

    expect(css).toContain("--accent:oklch(0.72 0.15 250);");
    expect(css).toContain("--shadow:0 1px 2px rgba(0, 0, 0, 0.2);");
    expect(css).toContain("--ink:var(--gold);");
  });

  it("test_a_value_closing_the_style_element_is_dropped", () => {
    const css = buildThemeOverridesCss({
      light: { "--gold": "red</style><script>alert(1)</script>" },
      dark: {},
    });

    expect(css).toBe("");
  });

  it("test_a_value_closing_the_declaration_block_is_dropped", () => {
    const css = buildThemeOverridesCss({
      light: { "--gold": "red}body{display:none" },
      dark: {},
    });

    expect(css).toBe("");
  });

  it("test_a_property_that_is_not_a_custom_property_is_dropped", () => {
    const css = buildThemeOverridesCss({
      light: { "body{color": "red" },
      dark: {},
    });

    expect(css).toBe("");
  });

  it("test_a_dropped_override_is_reported", () => {
    buildThemeOverridesCss({ light: { "--gold": "red;}" }, dark: {} });

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("--gold"));
  });

  it("test_a_safe_override_survives_an_unsafe_neighbour", () => {
    const css = buildThemeOverridesCss({
      light: { "--gold": "#0f7f95", "--bad": "red;}" },
      dark: {},
    });

    expect(css).toBe(":root{--gold:#0f7f95;}");
  });
});
