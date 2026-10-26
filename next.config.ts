import type { NextConfig } from "next";

// GitHub Pages serves /how-many-beers/. Cloudflare Pages serves at the domain root.
// Set DEPLOY_TARGET=cloudflare in the Cloudflare Pages build environment.
const cloudflare = process.env.DEPLOY_TARGET === "cloudflare";
const nextConfig: NextConfig = {
  output: "export",
  env: {
    NEXT_PUBLIC_BUILD_SHA: process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "local",
    NEXT_PUBLIC_BUILD_BRANCH: process.env.CF_PAGES_BRANCH ?? (process.env.GITHUB_REF_NAME || (cloudflare ? "dev" : "main")),
  },
  ...(cloudflare ? {} : { basePath: "/how-many-beers", assetPrefix: "/how-many-beers/" }),
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
