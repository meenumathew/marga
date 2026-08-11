/**
 * Site configuration: the base template's defaults, plus this site's overrides.
 *
 * A site created from this template should NOT edit this file. Its name,
 * description, dashboard copy, and theme colours belong in an untracked
 * `.env.local`, which `marga new` writes and `docs/how-to/configure-your-site.md`
 * documents. This file stays identical to the base template so that pulling
 * template improvements is a fast-forward with nothing to merge.
 *
 * Edit here only to change a default for every site, or to add a field: the
 * shape below is the contract, and `site-overrides.ts` decides which parts of it
 * a single site can restate.
 */

import { applySiteOverrides, readSiteOverrides } from "./site-overrides";

export type ThemeOverrides = Record<string, string>;

export type LogoTone = "onDark" | "onLight";
export type LogoVariant = "horizontal" | "stacked" | "mark";

/** Icon names map to Lucide icons inside the dashboard (see iconMap in page.tsx). */
export type NavLink = {
  label: string;
  href: string;
  icon: string;
  detail?: string;
};

export type SiteConfig = {
  /** Site name shown in page titles and metadata. */
  name: string;
  /** Meta description for the root layout. */
  description: string;
  /** Prefix for localStorage keys (theme, dashboard profile). Keep it unique per site. */
  storagePrefix: string;
  logo: {
    /** Accessible label for the logo link. */
    label: string;
    /** SVG assets in /public per variant and tone. Replace these files in a clone. */
    assets: Record<LogoVariant, Record<LogoTone, string>>;
  };
  home: {
    searchPlaceholder: string;
    defaultProfile: {
      displayName: string;
      focusArea: string;
      weeklyTarget: string;
      heroMessage: string;
    };
  };
  /** Top navigation pills on the dashboard. */
  nav: NavLink[];
  /** Mobile bottom navigation. */
  bottomNav: NavLink[];
  learn: {
    kicker: string;
    title: string;
    intro: string;
  };
  addContent: {
    kicker: string;
    title: string;
    intro: string;
  };
  /**
   * CSS variable overrides applied on top of globals.css, per theme.
   * Example: { light: { "--gold": "#0f7f95" }, dark: { "--gold-2": "#22d3ee" } }
   */
  theme: {
    light: ThemeOverrides;
    dark: ThemeOverrides;
  };
};

/** The base template's values, before this site's overrides. */
export const siteDefaults: SiteConfig = {
  name: "MARGA",
  description: "A customizable learning dashboard for courses, roadmaps, notes, and progress.",
  storagePrefix: "marga",
  logo: {
    label: "MARGA dashboard",
    assets: {
      horizontal: {
        onDark: "/marga-logo-with-tagline-horizontal-on-dark.svg",
        onLight: "/marga-logo-with-tagline-horizontal-on-light-transparent.svg",
      },
      stacked: {
        onDark: "/marga-logo-with-tagline-stacked-on-dark.svg",
        onLight: "/marga-logo-with-tagline-stacked-on-light.svg",
      },
      mark: {
        onDark: "/apple-touch-icon.svg",
        onLight: "/apple-touch-icon.svg",
      },
    },
  },
  home: {
    searchPlaceholder: "Search your notes, sections, and plans...",
    defaultProfile: {
      displayName: "Learner",
      focusArea: "Your craft",
      weeklyTarget: "5h this week",
      heroMessage: "Stay consistent. Keep learning. You are closer than you think.",
    },
  },
  nav: [
    { label: "Dashboard", href: "/", icon: "home" },
    { label: "Library", href: "/learn", icon: "book-open" },
    { label: "Milestones", href: "/milestones", icon: "calendar" },
    { label: "Plans", href: "/plans", icon: "target" },
    { label: "Evidence", href: "/evidence", icon: "clipboard-check" },
    { label: "Achievements", href: "/achievements", icon: "trophy" },
    { label: "Add Content", href: "/add-content", icon: "plus" },
  ],
  bottomNav: [
    { label: "Home", href: "/", icon: "home" },
    { label: "Library", href: "/learn", icon: "book-open" },
    { label: "Evidence", href: "/evidence", icon: "clipboard-check" },
    { label: "Achievements", href: "/achievements", icon: "trophy" },
  ],
  learn: {
    kicker: "Markdown-powered learning",
    title: "Turn notes into a learning website",
    intro:
      "Add `.md` or Markdown-compatible `.mdx` files under `content/learn`, and the site turns them into searchable notes with clean reading pages.",
  },
  addContent: {
    kicker: "For non-coders",
    title: "Add notes with a form, not code",
    intro:
      "This local content studio writes Markdown files into `content/learn`. It is ideal for personal notes and internal authoring before you add a real CMS.",
  },
  theme: {
    light: {},
    dark: {},
  },
};

/** What every component reads: the defaults with this site's overrides applied. */
export const site: SiteConfig = applySiteOverrides(siteDefaults, readSiteOverrides());

export const themeStorageKey = `${site.storagePrefix}-theme`;
export const dashboardProfileStorageKey = `${site.storagePrefix}-dashboard-profile`;

/** A CSS custom property name: two dashes, then letters, digits, and dashes. */
const CUSTOM_PROPERTY_PATTERN = /^--[a-zA-Z0-9-]+$/;

/**
 * What a colour, length, or shadow needs — and nothing that could close the
 * declaration block or the element holding it.
 */
const SAFE_VALUE_PATTERN = /^[a-zA-Z0-9\s#%.,()+*/_-]+$/;

/** Serialize theme overrides into a CSS string injected by the root layout. */
export function buildThemeOverridesCss(theme: SiteConfig["theme"]): string {
  const blocks: string[] = [];
  const light = safeThemeDeclarations(theme.light);
  const dark = safeThemeDeclarations(theme.dark);

  if (light) {
    blocks.push(`:root{${light}}`);
  }

  if (dark) {
    blocks.push(`[data-theme="dark"]{${dark}}`);
  }

  return blocks.join("\n");
}

/**
 * The declarations that are safe to inline, dropping and reporting the rest.
 *
 * The layout puts this string inside a `<style>` element, so a value carrying
 * `</style>` or a stray `}` would escape the block it belongs to and could end up
 * running as script on every page. These overrides are checked-in config rather
 * than anything a visitor types, but a typo here is a site-wide problem, so the
 * shape is enforced instead of assumed.
 */
function safeThemeDeclarations(overrides: ThemeOverrides): string {
  return Object.entries(overrides)
    .filter(([property, value]) => {
      if (CUSTOM_PROPERTY_PATTERN.test(property) && SAFE_VALUE_PATTERN.test(value)) {
        return true;
      }

      console.warn(`marga: ignoring theme override "${property}" — unsupported name or value`);
      return false;
    })
    .map(([property, value]) => `${property}:${value};`)
    .join("");
}
