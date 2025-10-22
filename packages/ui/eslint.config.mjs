import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";

const typescriptRecommended = tseslint.configs["flat/recommended"];

const config = [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
    ],
  },
  js.configs.recommended,
  ...typescriptRecommended,
  {
    rules: {
      "prefer-const": "error",
      "no-var": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default config;
