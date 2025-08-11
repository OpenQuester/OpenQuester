import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  base: "/v1/admin/",
  resolve: {
    alias: {
      // Provide explicit alias so build (Docker) doesn't rely solely on tsconfig-paths plugin
      "@server-dto": resolve(__dirname, "../server/src/domain/types/dto"),
    },
  },
  server: {
    port: 3001,
    proxy: {
      "/v1": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
