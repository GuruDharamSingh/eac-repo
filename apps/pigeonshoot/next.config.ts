import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @elkdonis/ui is deliberately NOT transpiled here.
  //
  // It carries react as a devDependency, so pnpm gives it its own physical
  // copy. Transpiling its source would compile that source in-app and bind it
  // to that second React instance — hooks then read a null context and
  // rendering dies (it surfaces as "Cannot read properties of null (reading
  // 'useContext')" during prerender). Consuming its built dist instead lets
  // tsup's `external: react` resolve React from this app.
  //
  // The only thing imported from @elkdonis/ui here is BaroqueSignup, which is
  // Mantine-free. Everything else visual in this app is shadcn/Tailwind.
  //
  // @elkdonis/studio-ui, by contrast, MUST be transpiled: its package main
  // points at raw ./src/index.ts, so there is no dist to consume.
  transpilePackages: [
    "@elkdonis/cms-ui",
    "@elkdonis/db",
    "@elkdonis/email",
    "@elkdonis/types",
    "@elkdonis/utils",
    "@elkdonis/auth-client",
    "@elkdonis/services",
    "@elkdonis/studio-ui",
  ],
  // sharp is a native module — it must never be bundled into the server build.
  // Next externalizes it by default; naming it here makes that survive a
  // turbopack config change.
  serverExternalPackages: ["sharp"],
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
};

export default nextConfig;
