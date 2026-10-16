import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["lib/**", "node_modules/**"],
    env: {
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      GCLOUD_PROJECT: "bizbooster-gabon",
    },
    testTimeout: 10000,
  },
});
