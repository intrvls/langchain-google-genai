import { defineConfig } from "tsdown";
import pkg from "./package.json" with { type: "json" };

// Standalone build config. The upstream LangChain monorepo used the internal
// `@langchain/build` helper (`getBuildConfig` + `cjsCompatPlugin`); here we
// inline the equivalent dual ESM/CJS output so the package builds without any
// workspace-only tooling. The `cjs` format emits `index.cjs` / `index.d.cts`,
// which the `exports` map in package.json points at.
export default defineConfig({
  entry: ["./src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  outDir: "dist",
  clean: true,
  sourcemap: true,
  define: { __PKG_VERSION__: JSON.stringify(pkg.version) },
});
