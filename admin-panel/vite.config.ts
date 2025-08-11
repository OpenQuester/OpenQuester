import react from "@vitejs/plugin-react";
import fs from "fs";
import { resolve } from "path";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  base: "/v1/admin/",
  resolve: {
    alias: (() => {
      const primary = resolve(
        __dirname,
        "../server/src/domain/types/dto/index.ts"
      );
      if (fs.existsSync(primary)) {
        return { "@server-dto": primary };
      }
      // Fallback to copied lightweight snapshot inside admin-panel/.server-types (Docker build context)
      const fallback = resolve(__dirname, "./.server-types/dto/index.ts");
      return { "@server-dto": fallback };
    })(),
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
