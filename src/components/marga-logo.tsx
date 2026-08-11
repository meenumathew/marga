import Image from "next/image";
import Link from "next/link";
import { site, type LogoVariant } from "@/config/site";

type MargaLogoVariant = LogoVariant;
type MargaLogoTone = "onDark" | "onLight" | "auto";

type MargaLogoProps = {
  href?: string | null;
  className?: string;
  variant?: MargaLogoVariant;
  tone?: MargaLogoTone;
  label?: string;
};

const toneClass: Record<MargaLogoTone, string> = {
  auto: "marga-logo--auto",
  onDark: "marga-logo--on-dark",
  onLight: "marga-logo--on-light",
};

const logoAssets = site.logo.assets;

const logoSizes: Record<MargaLogoVariant, { width: number; height: number }> = {
  horizontal: { width: 780, height: 200 },
  stacked: { width: 520, height: 460 },
  mark: { width: 180, height: 180 },
};

export function MargaLogo({
  href = "/",
  className = "",
  variant = "horizontal",
  tone = "onDark",
  label = site.logo.label,
}: MargaLogoProps) {
  const resolvedTone = tone === "auto" ? "onLight" : tone;
  const logoSize = logoSizes[variant];
  const logoClassName = [
    "brand",
    "marga-logo",
    `marga-logo--${variant}`,
    toneClass[tone],
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const content = (
    <Image
      className="marga-logo-asset"
      src={logoAssets[variant][resolvedTone]}
      alt=""
      width={logoSize.width}
      height={logoSize.height}
      priority
      unoptimized
    />
  );

  if (!href) {
    return (
      <span className={logoClassName} aria-label={label} role="img">
        {content}
      </span>
    );
  }

  return (
    <Link className={logoClassName} href={href} aria-label={label}>
      {content}
    </Link>
  );
}
