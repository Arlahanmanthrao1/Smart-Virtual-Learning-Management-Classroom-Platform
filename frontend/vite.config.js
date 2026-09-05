import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import brand from "./src/branding/brand.json";

const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

export default defineConfig({
  plugins: [react(), {
    name: "platform-brand-metadata",
    transformIndexHtml(html) {
      return {
        html: html.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(brand.name)}</title>`),
        tags: [
          { tag: "link", attrs: { rel: "icon", type: "image/svg+xml", href: "/brand-mark.svg" }, injectTo: "head" },
          { tag: "meta", attrs: { name: "application-name", content: brand.name }, injectTo: "head" },
          { tag: "meta", attrs: { name: "description", content: brand.description }, injectTo: "head" },
          { tag: "meta", attrs: { name: "theme-color", content: brand.themeColor }, injectTo: "head" },
        ],
      };
    },
  }],
  server: {
    port: 5173,
  },
});
