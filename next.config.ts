import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The Calendar page was renamed to Milestones; keep old links working.
      { source: "/calendar", destination: "/milestones", permanent: true },
    ];
  },
};

export default nextConfig;
