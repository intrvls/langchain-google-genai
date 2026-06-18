import {
  configDefaults,
  defineConfig,
  type ViteUserConfigExport,
} from "vitest/config";
import pkg from "./package.json" with { type: "json" };
const define = { __PKG_VERSION__: JSON.stringify(pkg.version) };

export default defineConfig((env) => {
  const common: ViteUserConfigExport = {
    test: {
      environment: "node",
      hideSkippedTests: true,
      testTimeout: 30_000,
      maxWorkers: 0.5,
      exclude: ["**/*.int.test.ts", ...configDefaults.exclude],
      setupFiles: ["dotenv/config"],
    },
  };

  if (env.mode === "int") {
    return {
      define,
      test: {
        ...common.test,
        globals: false,
        testTimeout: 100_000,
        exclude: configDefaults.exclude,
        include: ["**/*.int.test.ts"],
        name: "int",
        environment: "node",
      },
    };
  }

  return {
    define,
    test: {
      ...common.test,
      environment: "node",
      include: configDefaults.include,
      // Allow disabling typecheck in CI (e.g. dependency-range matrix runs)
      // where transitive dependencies may not resolve cleanly.
      typecheck: { enabled: !process.env.CI },
      env: {
        GOOGLE_API_KEY:
          process.env.GOOGLE_API_KEY || "fake-api-key-for-unit-tests",
      },
    },
  };
});
