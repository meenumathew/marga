import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { buildThemeOverridesCss, site, themeStorageKey } from "@/config/site";
import { resolveMetadataBase } from "@/lib/metadata-base";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Undefined unless NEXT_PUBLIC_SITE_URL is set; see resolveMetadataBase.
  metadataBase: resolveMetadataBase(process.env.NEXT_PUBLIC_SITE_URL),
  title: site.name,
  description: site.description,
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeOverridesCss = buildThemeOverridesCss(site.theme);

  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var theme=localStorage.getItem(${JSON.stringify(themeStorageKey)})==="dark"?"dark":"light";document.documentElement.dataset.theme=theme;}catch(e){document.documentElement.dataset.theme="light";}`,
          }}
        />
        {themeOverridesCss ? (
          <style dangerouslySetInnerHTML={{ __html: themeOverridesCss }} />
        ) : null}
        {children}
      </body>
    </html>
  );
}
