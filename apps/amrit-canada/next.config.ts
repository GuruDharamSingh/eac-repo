import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@elkdonis/db", "@elkdonis/types", "@elkdonis/ui", "@elkdonis/auth-client"],
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  webpack: (config) => {
    // Force all Mantine imports (including those from @elkdonis/ui) to resolve
    // to the same copy in this app's node_modules. Prevents duplicate React
    // context instances that break MantineProvider.
    const mantinePackages = [
      "@mantine/core",
      "@mantine/hooks",
      "@mantine/form",
      "@mantine/dates",
      "@mantine/tiptap",
      "@mantine/notifications",
    ];
    for (const pkg of mantinePackages) {
      config.resolve.alias[pkg] = path.resolve("./node_modules/" + pkg);
    }
    return config;
  },
};

export default nextConfig;
