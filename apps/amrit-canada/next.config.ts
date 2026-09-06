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
  // This is the successor to the @mantine/* aliasing the pre-rebuild config
  // carried: same duplicate-copy problem, different package. The only thing
  // imported from @elkdonis/ui now is BaroqueSignup, which is Mantine-free.
  transpilePackages: [
    "@elkdonis/db",
    "@elkdonis/email",
    "@elkdonis/types",
    "@elkdonis/utils",
    "@elkdonis/auth-client",
    "@elkdonis/services",
  ],
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
};

export default nextConfig;
