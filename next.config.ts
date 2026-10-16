import type { NextConfig } from "next";

// GitHub Pages hosts this project at /how-many-beers/ rather than at the domain root.
// The MVP runs entirely in the browser, so it can be exported as static files.
const nextConfig: NextConfig = {
  output: "export",
  basePath: "/how-many-beers",
  assetPrefix: "/how-many-beers/",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
