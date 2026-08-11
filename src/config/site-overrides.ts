import type { SiteConfig, ThemeOverrides } from "./site";

/**
 * Per-site branding, read from the environment instead of edited into code.
 *
 * A site created from this template keeps its own name, description, and colours
 * in an untracked `.env.local` file, so `src/config/site.ts` stays the base
 * template's file. That is the whole point: the two things every site changes
 * used to be the two things a `git pull base main` also changed, and every
 * update conflicted. Nothing here is tracked, so nothing here can conflict.
 *
 * See `docs/how-to/configure-your-site.md` for the adopter-facing version.
 */
export type SiteOverrides = {
  name?: string;
  description?: string;
  storagePrefix?: string;
  logoLabel?: string;
  displayName?: string;
  focusArea?: string;
  weeklyTarget?: string;
  heroMessage?: string;
  themeLight?: ThemeOverrides;
  themeDark?: ThemeOverrides;
};

/** A declared value, or undefined when the variable is absent or blank. */
function text(value: string | undefined): string | undefined {
  const declared = value?.trim();
  return declared ? declared : undefined;
}

/**
 * Parse a theme override variable: a JSON object of CSS custom properties.
 *
 * Property names and values are checked again at render time by
 * `buildThemeOverridesCss`, which is what keeps an unsafe value out of the
 * inline `<style>` element. This only rejects a shape that could not be theme
 * overrides at all, so a typo fails loudly here instead of vanishing later.
 */
function themeOverrides(value: string | undefined, variable: string): ThemeOverrides | undefined {
  const declared = text(value);

  if (!declared) {
    return undefined;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(declared);
  } catch {
    console.warn(`marga: ignoring ${variable} — expected a JSON object of CSS custom properties`);
    return undefined;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    console.warn(`marga: ignoring ${variable} — expected a JSON object of CSS custom properties`);
    return undefined;
  }

  const entries = Object.entries(parsed);

  if (entries.some(([, propertyValue]) => typeof propertyValue !== "string")) {
    console.warn(`marga: ignoring ${variable} — every value must be a string`);
    return undefined;
  }

  return Object.fromEntries(entries) as ThemeOverrides;
}

/**
 * The overrides declared for this site.
 *
 * Every variable is named literally, and that is not a style choice: Next
 * inlines `process.env.NEXT_PUBLIC_*` into the browser bundle by substituting
 * the exact text it finds. A computed lookup such as `process.env[key]` compiles
 * to nothing and would read as undefined in the browser, so the dashboard would
 * quietly show the template's name while the page title showed the site's.
 */
export function readSiteOverrides(): SiteOverrides {
  const overrides: SiteOverrides = {
    name: text(process.env.NEXT_PUBLIC_MARGA_SITE_NAME),
    description: text(process.env.NEXT_PUBLIC_MARGA_SITE_DESCRIPTION),
    storagePrefix: text(process.env.NEXT_PUBLIC_MARGA_STORAGE_PREFIX),
    logoLabel: text(process.env.NEXT_PUBLIC_MARGA_LOGO_LABEL),
    displayName: text(process.env.NEXT_PUBLIC_MARGA_DISPLAY_NAME),
    focusArea: text(process.env.NEXT_PUBLIC_MARGA_FOCUS_AREA),
    weeklyTarget: text(process.env.NEXT_PUBLIC_MARGA_WEEKLY_TARGET),
    heroMessage: text(process.env.NEXT_PUBLIC_MARGA_HERO_MESSAGE),
    themeLight: themeOverrides(
      process.env.NEXT_PUBLIC_MARGA_THEME_LIGHT,
      "NEXT_PUBLIC_MARGA_THEME_LIGHT",
    ),
    themeDark: themeOverrides(
      process.env.NEXT_PUBLIC_MARGA_THEME_DARK,
      "NEXT_PUBLIC_MARGA_THEME_DARK",
    ),
  };

  // Drop the undeclared keys so the result reads as what the site actually set.
  return Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined),
  ) as SiteOverrides;
}

/**
 * The site configuration: template defaults with this site's overrides on top.
 *
 * Pure, and it copies rather than writes through, so the defaults stay readable
 * as the defaults. Theme overrides merge per property instead of replacing the
 * block, so declaring one colour does not drop the others.
 */
export function applySiteOverrides(base: SiteConfig, overrides: SiteOverrides): SiteConfig {
  return {
    ...base,
    name: overrides.name ?? base.name,
    description: overrides.description ?? base.description,
    storagePrefix: overrides.storagePrefix ?? base.storagePrefix,
    logo: {
      ...base.logo,
      // A renamed site that kept the default label would read the template's
      // name out to a screen reader on every page, so the name carries it.
      label: overrides.logoLabel ?? overrides.name ?? base.logo.label,
      assets: base.logo.assets,
    },
    home: {
      ...base.home,
      defaultProfile: {
        displayName: overrides.displayName ?? base.home.defaultProfile.displayName,
        focusArea: overrides.focusArea ?? base.home.defaultProfile.focusArea,
        weeklyTarget: overrides.weeklyTarget ?? base.home.defaultProfile.weeklyTarget,
        heroMessage: overrides.heroMessage ?? base.home.defaultProfile.heroMessage,
      },
    },
    theme: {
      light: { ...base.theme.light, ...overrides.themeLight },
      dark: { ...base.theme.dark, ...overrides.themeDark },
    },
  };
}
