import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applySiteOverrides, readSiteOverrides } from "./site-overrides";
import { siteDefaults } from "./site";

/**
 * Every variable the override layer reads. The tests clear all of them before
 * each case so a value exported in the developer's own shell cannot decide
 * whether a test passes.
 */
const ENV_KEYS = [
  "NEXT_PUBLIC_MARGA_SITE_NAME",
  "NEXT_PUBLIC_MARGA_SITE_DESCRIPTION",
  "NEXT_PUBLIC_MARGA_STORAGE_PREFIX",
  "NEXT_PUBLIC_MARGA_LOGO_LABEL",
  "NEXT_PUBLIC_MARGA_DISPLAY_NAME",
  "NEXT_PUBLIC_MARGA_FOCUS_AREA",
  "NEXT_PUBLIC_MARGA_WEEKLY_TARGET",
  "NEXT_PUBLIC_MARGA_HERO_MESSAGE",
  "NEXT_PUBLIC_MARGA_THEME_LIGHT",
  "NEXT_PUBLIC_MARGA_THEME_DARK",
];

beforeEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("readSiteOverrides", () => {
  it("test_no_declared_variables_reads_as_no_overrides", () => {
    expect(readSiteOverrides()).toEqual({});
  });

  it("test_each_declared_variable_reads_into_its_field", () => {
    vi.stubEnv("NEXT_PUBLIC_MARGA_SITE_NAME", "PE Site");
    vi.stubEnv("NEXT_PUBLIC_MARGA_SITE_DESCRIPTION", "Your path to mastery.");
    vi.stubEnv("NEXT_PUBLIC_MARGA_STORAGE_PREFIX", "pe-site");
    vi.stubEnv("NEXT_PUBLIC_MARGA_LOGO_LABEL", "PE");
    vi.stubEnv("NEXT_PUBLIC_MARGA_DISPLAY_NAME", "Meenu");
    vi.stubEnv("NEXT_PUBLIC_MARGA_FOCUS_AREA", "Product engineering");
    vi.stubEnv("NEXT_PUBLIC_MARGA_WEEKLY_TARGET", "8h this week");
    vi.stubEnv("NEXT_PUBLIC_MARGA_HERO_MESSAGE", "Begin the climb.");

    expect(readSiteOverrides()).toEqual({
      name: "PE Site",
      description: "Your path to mastery.",
      storagePrefix: "pe-site",
      logoLabel: "PE",
      displayName: "Meenu",
      focusArea: "Product engineering",
      weeklyTarget: "8h this week",
      heroMessage: "Begin the climb.",
    });
  });

  it("test_a_blank_variable_reads_as_not_declared", () => {
    // `NEXT_PUBLIC_MARGA_SITE_NAME=` in a .env file arrives as an empty string,
    // which means "I left this alone", not "name the site nothing".
    vi.stubEnv("NEXT_PUBLIC_MARGA_SITE_NAME", "   ");

    expect(readSiteOverrides()).toEqual({});
  });

  it("test_surrounding_whitespace_is_trimmed", () => {
    vi.stubEnv("NEXT_PUBLIC_MARGA_SITE_NAME", "  PE Site  ");

    expect(readSiteOverrides().name).toBe("PE Site");
  });

  it("test_theme_overrides_are_read_as_json_objects", () => {
    vi.stubEnv("NEXT_PUBLIC_MARGA_THEME_LIGHT", '{"--gold":"#0f7f95"}');
    vi.stubEnv("NEXT_PUBLIC_MARGA_THEME_DARK", '{"--gold-2":"#22d3ee"}');

    expect(readSiteOverrides()).toEqual({
      themeLight: { "--gold": "#0f7f95" },
      themeDark: { "--gold-2": "#22d3ee" },
    });
  });

  it("test_a_theme_override_that_is_not_json_is_ignored_with_a_warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NEXT_PUBLIC_MARGA_THEME_LIGHT", "--gold: #0f7f95");

    expect(readSiteOverrides()).toEqual({});
    expect(warn).toHaveBeenCalledOnce();
  });

  it("test_a_theme_override_that_is_not_an_object_of_strings_is_ignored", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NEXT_PUBLIC_MARGA_THEME_LIGHT", '["--gold"]');
    vi.stubEnv("NEXT_PUBLIC_MARGA_THEME_DARK", '{"--gold":12}');

    expect(readSiteOverrides()).toEqual({});
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe("applySiteOverrides", () => {
  it("test_no_overrides_leaves_every_default_in_place", () => {
    expect(applySiteOverrides(siteDefaults, {})).toEqual(siteDefaults);
  });

  it("test_the_defaults_are_not_mutated", () => {
    const before = structuredClone(siteDefaults);

    applySiteOverrides(siteDefaults, { name: "PE Site", themeLight: { "--gold": "#0f7f95" } });

    expect(siteDefaults).toEqual(before);
  });

  it("test_declared_branding_replaces_the_defaults", () => {
    const resolved = applySiteOverrides(siteDefaults, {
      name: "PE Site",
      description: "Your path to mastery.",
      storagePrefix: "pe-site",
    });

    expect(resolved.name).toBe("PE Site");
    expect(resolved.description).toBe("Your path to mastery.");
    expect(resolved.storagePrefix).toBe("pe-site");
  });

  it("test_the_logo_label_follows_the_site_name_when_not_declared", () => {
    // The default label names the default site, so a renamed site that kept it
    // would read its old name out to a screen reader on every page.
    expect(applySiteOverrides(siteDefaults, { name: "PE Site" }).logo.label).toBe("PE Site");
  });

  it("test_a_declared_logo_label_wins_over_the_site_name", () => {
    const resolved = applySiteOverrides(siteDefaults, { name: "PE Site", logoLabel: "PE" });

    expect(resolved.logo.label).toBe("PE");
  });

  it("test_the_logo_assets_are_untouched_because_a_clone_replaces_the_files", () => {
    expect(applySiteOverrides(siteDefaults, { name: "PE Site" }).logo.assets).toEqual(
      siteDefaults.logo.assets,
    );
  });

  it("test_declared_profile_fields_replace_the_dashboard_defaults", () => {
    const resolved = applySiteOverrides(siteDefaults, {
      displayName: "Meenu",
      focusArea: "Product engineering",
      weeklyTarget: "8h this week",
      heroMessage: "Begin the climb.",
    });

    expect(resolved.home.defaultProfile).toEqual({
      displayName: "Meenu",
      focusArea: "Product engineering",
      weeklyTarget: "8h this week",
      heroMessage: "Begin the climb.",
    });
  });

  it("test_an_undeclared_profile_field_keeps_its_default", () => {
    const resolved = applySiteOverrides(siteDefaults, { displayName: "Meenu" });

    expect(resolved.home.defaultProfile.focusArea).toBe(siteDefaults.home.defaultProfile.focusArea);
    expect(resolved.home.searchPlaceholder).toBe(siteDefaults.home.searchPlaceholder);
  });

  it("test_theme_overrides_merge_over_the_defaults_rather_than_replacing_them", () => {
    const base = {
      ...siteDefaults,
      theme: { light: { "--gold": "#b8860b", "--ink": "#111111" }, dark: {} },
    };

    const resolved = applySiteOverrides(base, { themeLight: { "--gold": "#0f7f95" } });

    expect(resolved.theme.light).toEqual({ "--gold": "#0f7f95", "--ink": "#111111" });
    expect(resolved.theme.dark).toEqual({});
  });
});
