module.exports = {
  extends: [
    "./index.js",
    "next/core-web-vitals",
  ],
  rules: {
    "@next/next/no-html-link-for-pages": "off",
  },
  env: {
    browser: true,
    es6: true,
    node: true,
  },
};