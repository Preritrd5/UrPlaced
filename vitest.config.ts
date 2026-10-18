import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "path";

export default defineConfig(({ mode }) => {
  // Load environment variables from .env
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  return {
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: [path.resolve(__dirname, "./src/test/setup.ts")],
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
