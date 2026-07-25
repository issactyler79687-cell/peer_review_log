import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    host: "127.0.0.1",
    port: 5173,
  },

  preview: {
    host: "127.0.0.1",
    port: 4173,
  },

  build: {
    target: "es2022",
    reportCompressedSize: true,

    /*
     * The generated Stellar SDK and typed bindings create a
     * large application chunk. Wallet code remains lazy-loaded
     * through the dynamic import in the application.
     *
     * Avoid manually assigning vendor chunks because React,
     * Stellar SDK and wallet dependencies share modules and
     * manual assignment created circular chunk dependencies.
     */
    chunkSizeWarningLimit: 3200,
  },
});
