import type { NextConfig } from "next";
import path from "path";

const mantinePackages = [
  "@mantine/core",
  "@mantine/hooks",
  "@mantine/form",
  "@mantine/dates",
  "@mantine/tiptap",
  "@mantine/notifications",
];

const nextConfig: NextConfig = {
  transpilePackages: ["@elkdonis/db", "@elkdonis/email", "@elkdonis/types", "@elkdonis/ui", "@elkdonis/auth-client"],
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  turbopack: {
    resolveAlias: Object.fromEntries(
      mantinePackages.map((pkg) => [pkg, path.resolve("./node_modules/" + pkg)])
    ),
  },
  webpack: (config) => {
    // Force all Mantine imports (including those from @elkdonis/ui) to resolve
    // to the same copy in this app's node_modules. Prevents duplicate React
    // context instances that break MantineProvider.
    for (const pkg of mantinePackages) {
      config.resolve.alias[pkg] = path.resolve("./node_modules/" + pkg);
    }
    return config;
  },
};

export default nextConfig;
