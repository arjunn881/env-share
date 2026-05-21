import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],      // CJS so Node loads it without "type":"module" gymnastics
  target: "node18",
  outDir: "dist",
  clean: true,
  dts: false,           // CLI binary — no type declarations needed
  splitting: false,     // Single-file bundle for easy global install / npx
  sourcemap: false,
  minify: true,
  shims: true,          // __dirname / __filename shims for ESM→CJS interop
  banner: {
    js: "#!/usr/bin/env node",  // Required: npm validates that bin files have a shebang
  },
  noExternal: [
    "chalk",
    "ora",
    "commander",
    "axios",
    "dotenv",
    "prompts",
  ],
});
