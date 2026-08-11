/**
 * The absolute base Next resolves page-metadata URLs against.
 *
 * Deliberately unset unless the deployment declares one. Next turns relative
 * metadata URLs (icons, canonical links, and any social image added later) into
 * absolute ones using this base, so a hardcoded `http://localhost:3000` default
 * would be worse than no base at all: a deployed page would advertise localhost
 * URLs that no reader can fetch. With no base, the URLs stay relative and keep
 * working on whatever origin serves them.
 */
export function resolveMetadataBase(value: string | undefined): URL | undefined {
  const declared = value?.trim();

  if (!declared) {
    return undefined;
  }

  let url: URL;

  try {
    url = new URL(declared);
  } catch {
    console.warn(`marga: ignoring site URL "${declared}" — not an absolute URL`);
    return undefined;
  }

  // A site origin is http(s). Anything else (data:, javascript:, file:) would be
  // carried into every generated URL on every page.
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    console.warn(`marga: ignoring site URL "${declared}" — expected http or https`);
    return undefined;
  }

  return url;
}
