import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";

const isLocalDevelopment = process.env.HALEY_STOREFRONT_LOCAL === "1";

export default defineConfig({
  site: "https://haleywali.pk",
  output: "server",
  adapter: isLocalDevelopment
    ? undefined
    : cloudflare({
        imageService: "compile",
      }),
  integrations: [react()],
  vite: {
    // Keep public storefront configuration in the repository-root .env file.
    // Vite only exposes variables prefixed with PUBLIC_ to browser code.
    envDir: "../../",
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    server: {
      watch: {
        usePolling: process.env.CODEX_SANDBOX === "seatbelt",
      },
    },
  },
});
