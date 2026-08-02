import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
// @ts-expect-error process is a nodejs global
const platform = process.env.TAURI_ENV_PLATFORM;
const isTauriMobile = platform === "ios" || platform === "android";
// @ts-expect-error process is a nodejs global
const isTauri = Boolean(process.env.TAURI_ENV_PLATFORM);

// https://vite.dev/config/
export default defineConfig(async () => ({
  // Embedded iOS/Android bundles load assets via a custom protocol — relative paths required.
  base: isTauri ? "./" : "/",
  plugins: [
    react(),
    tailwindcss(),
    ...(isTauri
      ? []
      : [
          VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.png", "apple-touch-icon.png", "maskable-icon.png"],
            manifest: {
              name: "DoneBun",
              short_name: "DoneBun",
              description: "Your daily task and calendar manager",
              theme_color: "#ffffff",
              icons: [
                {
                  src: "pwa-192x192.png",
                  sizes: "192x192",
                  type: "image/png",
                },
                {
                  src: "pwa-512x512.png",
                  sizes: "512x512",
                  type: "image/png",
                },
                {
                  src: "pwa-512x512.png",
                  sizes: "512x512",
                  type: "image/png",
                  purpose: "any maskable",
                },
              ],
            },
          }),
        ]),
  ],

  envPrefix: ["VITE_", "TAURI_ENV_*"],

  resolve: {
    alias: isTauri
      ? { "virtual:pwa-register": "/src/pwa-stub.ts" }
      : {},
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    // Tauri iOS/Android dev loads the page through a tauri:// proxy; Vite HMR
    // WebSockets break under that proxy and can leave a blank screen.
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : isTauriMobile
        ? false
        : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  build: {
    target:
      // @ts-expect-error process is a nodejs global
      process.env.TAURI_ENV_PLATFORM === "windows"
        ? "chrome105"
        : isTauri
          ? "safari16"
          : "esnext",
    // @ts-expect-error process is a nodejs global
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    // @ts-expect-error process is a nodejs global
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
}));
