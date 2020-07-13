module.exports = {
  globals: {
    __TEST__: true,
    babelConfig: true,
  },
  collectCoverageFrom: [
    "packages/*/src/**/*.js",
    "!packages/runtime-test/src/utils/**",
    "!packages/template-explorer/**",
    "!packages/size-check/**",
    "!packages/runtime-core/src/profiling.js",
  ],
  watchPathIgnorePatterns: ["/node_modules/", "/dist/", "/.git/"],
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  rootDir: __dirname,
  testMatch: ["<rootDir>/packages/**/__tests__/**/*spec.[jt]s?(x)"],
  testPathIgnorePatterns: process.env.SKIP_E2E
    ? // ignore example tests on netlify builds since they don't contribute
      // to coverage and can cause netlify builds to fail
      ["/node_modules/", "/examples/__tests__"]
    : ["/node_modules/"],
};
