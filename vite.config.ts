import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // GitHub Pages는 https://<아이디>.github.io/<레포>/ 경로라서 배포 때만 base를 바꿔줌
  base: process.env.BASE_PATH ?? "/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon-32x32.png", "favicon-64x64.png", "apple-touch-icon.png"],
      manifest: {
        name: "Today's News",
        short_name: "Today",
        description: "금감원·금융위 보도자료와 경제·정치·IT·과학·문화 뉴스 큐레이터",
        lang: "ko",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          // 안드로이드 원형/둥근 마스크용 (여백 있는 버전)
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        importScripts: ["push-sw.js"], // 푸시 알림 처리
        runtimeCaching: [
          {
            // 뉴스 데이터: 네트워크 우선, 오프라인이면 캐시
            urlPattern: ({ url }) => url.pathname.endsWith("/data/news.json"),
            handler: "NetworkFirst",
            options: { cacheName: "news-data", networkTimeoutSeconds: 3 },
          },
        ],
      },
    }),
  ],
});
